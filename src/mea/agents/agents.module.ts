import { Module } from '@nestjs/common';
import { AgentNodesService } from './services/agent-nodes.service';
import { MedicalAgentGraphService } from './graph/medical-agent-graph.service';
import { RagModule } from '../rag/rag.module';

/**
 * Agents Module
 * 
 * Contains the AI agents for medical examination analysis:
 * - Scribe Agent: Transcript → SOAP notes
 * - ICD-10 Agent: SOAP → ICD codes
 * - Expert Agent: RAG-based medical advice
 * 
 * All agents are orchestrated via LangGraph in MedicalAgentGraphService.
 */
@Module({
    imports: [RagModule],
    providers: [AgentNodesService, MedicalAgentGraphService],
    exports: [MedicalAgentGraphService],
})
export class AgentsModule { }
