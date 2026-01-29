import { Module } from '@nestjs/common';
import { SttModule } from './stt/stt.module';
import { AgentsModule } from './agents/agents.module';
import { RagModule } from './rag/rag.module';
import { AnalyzeModule } from './analyze/analyze.module';
import { ComparisonModule } from './comparison/comparison.module';
import { MeaSessionModule } from './sessions/mea-session.module';
import { MeaDashboardModule } from './dashboard/mea-dashboard.module';

/**
 * Medical Examination Assistant (MEA) Module
 * 
 * This module integrates AI-powered medical examination features:
 * - Speech-to-Text (STT) for recording consultations
 * - AI Agents for SOAP notes, ICD-10 coding, and medical advice
 * - RAG (Retrieval Augmented Generation) for medical knowledge
 * - Comparison analysis between AI and Doctor results
 */
@Module({
    imports: [
        RagModule,          // Must be first - provides VectorStore
        AgentsModule,       // AI Agents (depends on RagModule)
        SttModule,          // Speech-to-Text
        AnalyzeModule,      // Orchestrates AI workflow
        ComparisonModule,   // AI vs Doctor comparison
        MeaSessionModule,   // Examination sessions
        MeaDashboardModule, // Dashboard stats
    ],
    exports: [
        SttModule,
        AgentsModule,
        AnalyzeModule,
        ComparisonModule,
        MeaSessionModule,
        MeaDashboardModule,
    ],
})
export class MeaModule { }
