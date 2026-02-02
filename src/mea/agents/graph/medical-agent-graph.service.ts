//Điều phối 3 agents chạy như thế nào
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState } from './agent.state';
import { AgentNodesService } from '../services/agent-nodes.service';

/**
 * Medical Agent Graph Service
 * 
 * Orchestrates the AI agent workflow using LangGraph.
 * 
 * Workflow:
 * START → Scribe Agent → [ICD Agent, Expert Agent] (parallel) → END
 * 
 * The graph automatically manages state flow between agents:
 * 1. Scribe Agent receives transcript, outputs SOAP notes
 * 2. ICD Agent and Expert Agent run in parallel with SOAP notes
 * 3. Results are merged into final state
 */
@Injectable()
export class MedicalAgentGraphService {
    private readonly logger = new Logger(MedicalAgentGraphService.name);
    private compiledGraph: any;

    constructor(private readonly agentNodesService: AgentNodesService) {
        this.initializeGraph();
    }

    /**
     * Initialize the LangGraph workflow
     */
    private initializeGraph() {
        // Define graph state with reducers
        const graphState = {
            transcript: {
                value: (x: string, y: string) => y ?? x,
                default: () => '',
            },
            soap: {
                value: (x: any, y: any) => (y ? { ...x, ...y } : x),
                default: () => ({
                    subjective: '',
                    objective: '',
                    assessment: '',
                    plan: '',
                }),
            },
            icdCodes: {
                value: (x: { code: string; description: string; confidence: number }[], y: { code: string; description: string; confidence: number }[]) => y ?? x,
                default: () => [],
            },
            medicalAdvice: {
                value: (x: string, y: string) => y ?? x,
                default: () => '',
            },
            references: {
                value: (x: string[], y: string[]) => y ?? x,
                default: () => [],
            },
        };

        // Create the Graph
        const workflow = new StateGraph<AgentState>({
            channels: graphState,
        })
            .addNode('scribe', (state: AgentState) =>
                this.agentNodesService.scribeNode(state),
            )
            .addNode('icd', (state: AgentState) =>
                this.agentNodesService.icdNode(state),
            )
            .addNode('expert', (state: AgentState) =>
                this.agentNodesService.expertNode(state),
            );

        // Define edges
        workflow.addEdge(START, 'scribe');      // Start with Scribe

        workflow.addEdge('scribe', 'icd');      // Scribe → ICD (parallel)
        workflow.addEdge('scribe', 'expert');   // Scribe → Expert (parallel)

        workflow.addEdge('icd', END);           // ICD → End
        workflow.addEdge('expert', END);        // Expert → End

        // Compile the graph
        this.compiledGraph = workflow.compile();
        this.logger.log('✅ Medical Agent Graph initialized');
    }

    /**
     * Invoke the agent workflow
     * 
     * @param input Object with transcript string
     * @returns Complete agent state with SOAP, ICD codes, and medical advice
     */
    async invoke(input: { transcript: string }): Promise<AgentState> {
        this.logger.log('🚀 Starting Medical Agent Workflow...');
        this.logger.debug(`Input transcript length: ${input.transcript.length} characters`);

        const startTime = Date.now();
        const result = await this.compiledGraph.invoke(input);
        const duration = Date.now() - startTime;

        this.logger.log(`✅ Workflow completed in ${duration}ms`);
        return result;
    }
}
