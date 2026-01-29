import { Injectable, Logger } from '@nestjs/common';
import { MedicalAgentGraphService } from '../agents/graph/medical-agent-graph.service';

/**
 * Analyze Service
 * 
 * Orchestrates the AI analysis workflow for medical transcripts.
 * Delegates to MedicalAgentGraphService for actual processing.
 */
@Injectable()
export class AnalyzeService {
    private readonly logger = new Logger(AnalyzeService.name);

    constructor(
        private readonly medicalAgentGraph: MedicalAgentGraphService,
    ) { }

    /**
     * Process a transcript through the AI agent workflow
     * 
     * @param transcript The medical consultation transcript
     * @returns SOAP notes, ICD codes, medical advice, and references
     */
    async processTranscript(transcript: string) {
        if (!transcript || transcript.trim().length === 0) {
            throw new Error('Transcript is required');
        }

        this.logger.log('🔬 Starting Medical Agent Workflow...');
        this.logger.debug(`Transcript length: ${transcript.length} characters`);

        // Invoke the LangGraph workflow
        const result = await this.medicalAgentGraph.invoke({
            transcript: transcript,
        });

        this.logger.log('✅ Workflow completed!');

        return {
            soap: result.soap,
            icdCodes: result.icdCodes,
            medicalAdvice: result.medicalAdvice,
            references: result.references,
        };
    }
}
