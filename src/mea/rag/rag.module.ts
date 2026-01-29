import { Module } from '@nestjs/common';
import { VectorStoreService } from './vectorstore.service';

/**
 * RAG (Retrieval Augmented Generation) Module
 * 
 * Provides vector store functionality for storing and retrieving medical knowledge.
 * Uses Google Embeddings and in-memory vector store.
 */
@Module({
    providers: [VectorStoreService],
    exports: [VectorStoreService],
})
export class RagModule { }
