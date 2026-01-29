import { Injectable, Logger } from '@nestjs/common';
import { SoapNote, ComparisonResult } from './dto/comparison.dto';
import { VectorStoreService } from '../rag/vectorstore.service';

/**
 * Comparison Agent Service
 * 
 * Calculates semantic similarity between AI and Doctor results.
 * Uses Google Embeddings for text similarity.
 */
@Injectable()
export class ComparisonAgentService {
    private readonly logger = new Logger(ComparisonAgentService.name);

    constructor(private readonly vectorStoreService: VectorStoreService) { }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Calculate semantic similarity between two texts using Google Embeddings
     */
    private async calculateTextSimilarity(
        text1: string,
        text2: string,
    ): Promise<number> {
        if (!text1 || !text2) return 0;
        if (text1 === text2) return 100;

        try {
            const embeddings = this.vectorStoreService.getEmbeddings();
            const [embedding1, embedding2] = await embeddings.embedDocuments([
                text1,
                text2,
            ]);
            const similarity = this.cosineSimilarity(embedding1, embedding2);
            return Math.max(0, Math.min(100, similarity * 100)); // 0-100%
        } catch (error) {
            this.logger.error('Error calculating similarity:', error);
            return 0;
        }
    }

    /**
     * Compare AI and Doctor medical results
     * 
     * @param aiSoap AI-generated SOAP notes
     * @param doctorSoap Doctor's SOAP notes
     * @param aiIcd AI-suggested ICD codes
     * @param doctorIcd Doctor's ICD codes
     * @returns Comparison result with scores and differences
     */
    async compareMedicalResults(
        aiSoap: SoapNote,
        doctorSoap: SoapNote,
        aiIcd: string[],
        doctorIcd: string[],
    ): Promise<ComparisonResult> {
        this.logger.log('🔍 Starting comparison analysis...');

        // 1. SOAP Comparison (Semantic)
        const soapMatch = {
            subjective: await this.calculateTextSimilarity(
                aiSoap.subjective,
                doctorSoap.subjective,
            ),
            objective: await this.calculateTextSimilarity(
                aiSoap.objective,
                doctorSoap.objective,
            ),
            assessment: await this.calculateTextSimilarity(
                aiSoap.assessment,
                doctorSoap.assessment,
            ),
            plan: await this.calculateTextSimilarity(aiSoap.plan, doctorSoap.plan),
        };

        // 2. ICD Comparison (Exact Match)
        // Clean codes (remove description if present)
        const cleanCode = (c: string) => c.split('-')[0].split(' ')[0].trim();

        const aiCodes = aiIcd.map(cleanCode);
        const docCodes = doctorIcd.map(cleanCode);

        const exactMatches = aiIcd.filter((_, i) => docCodes.includes(aiCodes[i]));
        const aiOnly = aiIcd.filter((_, i) => !docCodes.includes(aiCodes[i]));
        const doctorOnly = doctorIcd.filter((_, i) => !aiCodes.includes(docCodes[i]));

        // Calculate ICD score (Jaccard similarity)
        const union = new Set([...aiCodes, ...docCodes]);
        const intersection = aiCodes.filter((c) => docCodes.includes(c));
        const icdScore =
            union.size === 0 ? 100 : (intersection.length / union.size) * 100;

        // 3. Overall Match Score
        // Weights: Assessment (30%), Plan (30%), ICD (30%), Subjective/Objective (10%)
        const matchScore =
            soapMatch.assessment * 0.3 +
            soapMatch.plan * 0.3 +
            icdScore * 0.3 +
            ((soapMatch.subjective + soapMatch.objective) / 2) * 0.1;

        // 4. Generate Differences Summary
        const differences: string[] = [];
        if (soapMatch.assessment < 80)
            differences.push('Discrepancy in Assessment');
        if (soapMatch.plan < 80) differences.push('Discrepancy in Treatment Plan');
        if (aiOnly.length > 0)
            differences.push(
                `AI suggested extra codes: ${aiOnly.map((c) => cleanCode(c)).join(', ')}`,
            );
        if (doctorOnly.length > 0)
            differences.push(
                `Doctor added codes: ${doctorOnly.map((c) => cleanCode(c)).join(', ')}`,
            );

        const result = {
            matchScore: Math.round(matchScore),
            soapMatch: {
                subjective: Math.round(soapMatch.subjective),
                objective: Math.round(soapMatch.objective),
                assessment: Math.round(soapMatch.assessment),
                plan: Math.round(soapMatch.plan),
            },
            icdMatch: {
                exactMatches,
                aiOnly,
                doctorOnly,
                score: Math.round(icdScore),
            },
            differences,
        };

        this.logger.log(`✅ Comparison complete. Match score: ${result.matchScore}%`);
        return result;
    }
}
