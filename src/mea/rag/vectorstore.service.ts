import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/classic/text_splitter';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Vector Store Service
 * 
 * Manages the in-memory vector store for medical knowledge base.
 * Uses Google's text-embedding-004 model for generating embeddings.
 * 
 * Flow:
 * 1. On startup, loads existing vector store from disk (if exists)
 * 2. If not exists, seeds from markdown files in knowledge_base folder
 * 3. Provides retriever for RAG queries
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
    private readonly logger = new Logger(VectorStoreService.name);
    private store: MemoryVectorStore | null = null;
    private embeddings: GoogleGenerativeAIEmbeddings | null = null;
    private isInitialized = false;

    // Paths relative to project root
    private readonly vectorStorePath: string;
    private readonly knowledgeBasePath: string;

    constructor() {
        this.vectorStorePath = path.join(
            process.cwd(),
            'data',
            'vector_store',
            'db.json',
        );
        this.knowledgeBasePath = path.join(
            process.cwd(),
            'data',
            'knowledge_base',
            'protocols',
        );
    }

    /**
     * Load vector store khi khởi động
     */
    async onModuleInit() {
        try {
            await this.initialize();
        } catch (error) {
            this.logger.warn('VectorStore initialization skipped:', error.message);
            // Don't throw - allow app to start without RAG
        }
    }

    /**
     * Lazy initialization of embeddings
     */
    private getEmbeddingsInstance(): GoogleGenerativeAIEmbeddings {
        if (!this.embeddings) {
            const apiKey = process.env.GOOGLE_API_KEY;

            if (!apiKey) {
                throw new Error('Missing GOOGLE_API_KEY environment variable');
            }

            this.embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: 'text-embedding-004',
                apiKey,
            });
        }

        return this.embeddings;
    }

    /**
     * Initialize vector store from disk or create new one
     */
    async initialize() {
        if (this.isInitialized) return;

        const embeddings = this.getEmbeddingsInstance();

        try {
            // Try loading from file
            const fileData = await fs.readFile(this.vectorStorePath, 'utf-8');
            const json = JSON.parse(fileData);

            // Rehydrate MemoryVectorStore from JSON
            this.store = await MemoryVectorStore.fromTexts(
                json.texts,
                json.metadatas,
                embeddings,
            );
            this.logger.log('✅ Vector Store loaded from disk.');
            this.isInitialized = true;
        } catch (error) {
            this.logger.log('⚠️ No existing vector store found. Creating new one...');
            // Empty store
            this.store = new MemoryVectorStore(embeddings);

            // Seed data immediately if empty
            await this.seed();
            this.isInitialized = true;
        }
    }

    /**
     * Read markdown files from knowledge base, embed, and store
     */
    async seed() {
        this.logger.log('🌱 Seeding database from knowledge base...');

        const embeddings = this.getEmbeddingsInstance();

        try {
            // Check if knowledge base directory exists
            try {
                await fs.access(this.knowledgeBasePath);
            } catch {
                this.logger.warn(`⚠️ Knowledge base directory not found: ${this.knowledgeBasePath}`);
                this.store = new MemoryVectorStore(embeddings);
                return;
            }

            // Read all .md files
            const files = await fs.readdir(this.knowledgeBasePath);
            const docs: Document[] = [];

            for (const file of files) {
                if (!file.endsWith('.md')) continue;

                const filePath = path.join(this.knowledgeBasePath, file);
                const content = await fs.readFile(filePath, 'utf-8');

                docs.push(
                    new Document({
                        pageContent: content,
                        metadata: { source: file },
                    }),
                );
            }

            if (docs.length === 0) {
                this.logger.warn('⚠️ No documents found in knowledge base.');
                this.store = new MemoryVectorStore(embeddings);
                return;
            }

            // Split text into chunks
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const splitDocs = await splitter.splitDocuments(docs);

            // Create store with embeddings
            this.store = await MemoryVectorStore.fromDocuments(
                splitDocs,
                embeddings,
            );

            this.logger.log(`✅ Database seeded with ${splitDocs.length} chunks from ${docs.length} files.`);
        } catch (error) {
            this.logger.error('Error seeding vector store:', error);
            // Keep empty store
            this.store = new MemoryVectorStore(embeddings);
        }
    }

    /**
     * Get retriever for RAG queries
     * @param k Number of documents to retrieve (default: 3) Retriever: Tìm documents liên quan
     */
    getRetriever(k: number = 3) {
        if (!this.store) {
            throw new Error('Vector Store not initialized. Check GOOGLE_API_KEY.');
        }
        return this.store.asRetriever({ k });
    }

    /**
     * Get embeddings instance for similarity calculations: Embeddings: Text → Vector số học
     */
    getEmbeddings(): GoogleGenerativeAIEmbeddings {
        return this.getEmbeddingsInstance();
    }

    /**
     * Similarity search with scores for relevance filtering
     * @param query Search query
     * @param k Number of results to return
     * @returns Array of [Document, score] tuples
     */
    async similaritySearchWithScore(query: string, k: number = 3): Promise<[Document, number][]> {
        if (!this.store) {
            throw new Error('Vector Store not initialized. Check GOOGLE_API_KEY.');
        }
        return this.store.similaritySearchWithScore(query, k);
    }

    /**
     * Check if vector store is ready
     */
    isReady(): boolean {
        return this.isInitialized && this.store !== null;
    }
}
