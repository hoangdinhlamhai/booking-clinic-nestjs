import { Injectable, Logger } from '@nestjs/common';
import { AgentState } from '../graph/agent.state';
import { VectorStoreService } from '../../rag/vectorstore.service';
import { Document } from '@langchain/core/documents';
import { ollamaChat, OLLAMA_MODEL } from '../models/ollama.models';

/**
 * Agent Nodes Service (Ollama Version)
 * 
 * Contains the implementation of each AI agent node in the LangGraph workflow.
 * Uses local Ollama LLM for all inference tasks.
 * 
 * Agents:
 * 1. Scribe Agent: Converts transcript → SOAP notes
 * 2. ICD-10 Agent: Extracts ICD-10 codes from SOAP
 * 3. Expert Agent: Provides medical advice using RAG
 */
@Injectable()
export class AgentNodesService {
    private readonly logger = new Logger(AgentNodesService.name);

    constructor(private readonly vectorStoreService: VectorStoreService) { }

    /**
     * SCRIBE AGENT
     * Converts medical conversation transcript into structured SOAP notes.
     * 
     * @param state Current agent state with transcript
     * @returns Partial state with SOAP notes
     */
    async scribeNode(state: AgentState): Promise<Partial<AgentState>> {
        this.logger.log(`📝 Scribe Agent working (Ollama ${OLLAMA_MODEL})...`);

        const prompt = `Bạn là thư ký y khoa chuyên nghiệp.
Nhiệm vụ: Chuyển transcript hội thoại thành bệnh án chuẩn SOAP tiếng Việt.

Transcript:
"${state.transcript}"

Yêu cầu output JSON format:
{
    "subjective": "Tóm tắt triệu chứng cơ năng, bệnh sử...",
    "objective": "Tóm tắt triệu chứng thực thể, dấu hiệu sinh tồn (nếu có)...",
    "assessment": "Chẩn đoán sơ bộ...",
    "plan": "Kế hoạch điều trị, thuốc, dặn dò..."
}
Chỉ trả về JSON hợp lệ, không có text khác.`;

        try {
            const content = await ollamaChat(
                [{ role: 'user', content: prompt }],
                { temperature: 0.1, jsonFormat: true },
            );

            const soap = JSON.parse(content);

            this.logger.log('✅ Scribe Agent completed');
            return { soap };
        } catch (error) {
            this.logger.error('❌ Scribe Agent Error:', error);
            return {
                soap: {
                    subjective: '',
                    objective: '',
                    assessment: '',
                    plan: 'Error generating SOAP note',
                },
            };
        }
    }

    /**
     * ICD-10 AGENT
     * Extracts appropriate ICD-10 codes based on SOAP notes.
     * 
     * @param state Current agent state with SOAP notes
     * @returns Partial state with ICD-10 codes
     */
    async icdNode(state: AgentState): Promise<Partial<AgentState>> {
        this.logger.log(`🏷️ ICD-10 Agent working (Ollama ${OLLAMA_MODEL})...`);

        const prompt = `Bạn là chuyên gia về mã hóa bệnh lý ICD-10.
Chẩn đoán: "${state.soap.assessment}"
Triệu chứng: "${state.soap.subjective}"

Nhiệm vụ: Tìm mã ICD-10 phù hợp nhất (ưu tiên mã chi tiết).
Trả về kết quả dưới dạng JSON Object với key "codes" là danh sách các mã.
Ví dụ:
{
    "codes": ["K29.7 - Viêm dạ dày", "R10.1 - Đau vùng thượng vị"]
}`;

        try {
            const content = await ollamaChat(
                [{ role: 'user', content: prompt }],
                { temperature: 0.1, jsonFormat: true },
            );

            this.logger.debug('ICD-10 Raw Output:', content);

            const parsed = JSON.parse(content);
            // Normalize output - handle different response formats
            const codes = Array.isArray(parsed)
                ? parsed
                : parsed.codes || parsed.icd_codes || [];

            // Parse string codes into object format for frontend
            const formattedCodes = (Array.isArray(codes) ? codes : []).map((c, index) => {
                const codeStr = String(c);
                // Parse "K29.7 - Viêm dạ dày" format
                const match = codeStr.match(/^([A-Z]\d+\.?\d*)\s*[-–]\s*(.+)$/i);
                if (match) {
                    return {
                        code: match[1].toUpperCase(),
                        description: match[2].trim(),
                        confidence: Math.max(0.5, 1 - index * 0.1), // First code has highest confidence
                    };
                }
                // Fallback if format doesn't match
                return {
                    code: codeStr.split(/[-–]/)[0]?.trim() || codeStr,
                    description: codeStr.split(/[-–]/).slice(1).join('-').trim() || 'Không có mô tả',
                    confidence: 0.5,
                };
            });

            this.logger.log(`✅ ICD-10 Agent found ${formattedCodes.length} codes`);
            return { icdCodes: formattedCodes };
        } catch (error) {
            this.logger.error('❌ ICD-10 Agent Error:', error);
            return {
                icdCodes: [{
                    code: 'ERROR',
                    description: 'Lỗi lấy mã ICD-10. Kiểm tra Ollama đang chạy.',
                    confidence: 0
                }]
            };
        }
    }

    /**
     * MEDICAL EXPERT AGENT (RAG)
     * Provides medical advice based on knowledge base using RAG.
     * 
     * @param state Current agent state with SOAP notes
     * @returns Partial state with medical advice and references
     */
    async expertNode(state: AgentState): Promise<Partial<AgentState>> {
        this.logger.log(`🧑‍⚕️ Medical Expert Agent working (Ollama ${OLLAMA_MODEL} + RAG)...`);

        try {
            // Check if RAG is available
            if (!this.vectorStoreService.isReady()) {
                this.logger.warn('⚠️ RAG not available, using general knowledge');
                return this.generateAdviceWithoutRAG(state);
            }

            // 1. Retrieve relevant docs with similarity scores
            const query = `${state.soap.subjective} ${state.soap.assessment}`;
            const docsWithScores = await this.vectorStoreService.similaritySearchWithScore(query, 3);

            // 2. Filter by relevance threshold (0.5 = moderately relevant)
            const RELEVANCE_THRESHOLD = 0.5;
            const relevantDocs = docsWithScores.filter(([, score]) => score >= RELEVANCE_THRESHOLD);

            this.logger.log(`📊 RAG Results: ${docsWithScores.length} docs found, ${relevantDocs.length} above threshold (${RELEVANCE_THRESHOLD})`);

            // Log scores for debugging
            docsWithScores.forEach(([doc, score]) => {
                this.logger.debug(`  - ${doc.metadata.source}: score=${score.toFixed(3)}`);
            });

            // 3. If no relevant docs, use general knowledge mode
            if (relevantDocs.length === 0) {
                this.logger.log('⚠️ No relevant protocols found, using general knowledge');
                return this.generateAdviceWithoutRAG(state);
            }

            // 4. Build context from relevant docs only
            const context = relevantDocs.map(([doc]) => doc.pageContent).join('\n---\n');
            const references = relevantDocs.map(([doc]) =>
                (doc.metadata.source || 'Unknown Source').replace('.md', ''),
            );

            // 5. Ask LLM with Context
            const prompt = `Bạn là chuyên gia y tế cố vấn. TẤT CẢ PHẢN HỒI PHẢI BẰNG TIẾNG VIỆT.
Dựa vào Y VĂN ĐƯỢC CUNG CẤP dưới đây, hãy đưa ra nhận xét và gợi ý điều trị.

⚠️ CHÚ Ý QUAN TRỌNG:
- CHỈ đưa ra gợi ý nếu Y VĂN thực sự LIÊN QUAN đến triệu chứng của bệnh nhân.
- Nếu Y văn không liên quan chặt chẽ, hãy nói rõ và đưa ra gợi ý chung dựa trên kiến thức y khoa.

Y VĂN (Context):
${context}

BỆNH ÁN (SOAP):
S: ${state.soap.subjective}
O: ${state.soap.objective}
A: ${state.soap.assessment}
P (hiện tại): ${state.soap.plan}

YÊU CẦU (PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT):
- Đánh giá mức độ liên quan của Y văn với bệnh nhân này.
- Đưa ra lời khuyên ngắn gọn cho bác sĩ điều trị.
- Cảnh báo nếu phác đồ hiện tại (Plan) có gì sai sót.
- Gợi ý xét nghiệm/chẩn đoán hình ảnh cần làm thêm (nếu cần).
- Khi nào cần can thiệp chuyên khoa.

LƯU Ý: KHÔNG dùng tiếng Anh. Tất cả phải bằng TIẾNG VIỆT.`;

            const adviceContent = await ollamaChat(
                [{ role: 'user', content: prompt }],
                { temperature: 0.2 },
            );

            this.logger.log(`✅ Expert Agent completed with ${references.length} references`);
            return {
                medicalAdvice: adviceContent,
                references,
            };
        } catch (error) {
            this.logger.error('❌ Medical Expert Agent Error:', error);
            return {
                medicalAdvice: 'Error generating medical advice',
                references: [],
            };
        }
    }

    /**
     * Generate advice without RAG context (general knowledge mode)
     */
    private async generateAdviceWithoutRAG(state: AgentState): Promise<Partial<AgentState>> {
        const prompt = `Bạn là chuyên gia y tế cố vấn. TẤT CẢ PHẢN HỒI PHẢI BẰNG TIẾNG VIỆT.

⚠️ LƯU Ý: Không có phác đồ điều trị cụ thể trong cơ sở dữ liệu cho trường hợp này.
Hãy đưa ra gợi ý dựa trên kiến thức y khoa chung.

BỆNH ÁN (SOAP):
S: ${state.soap.subjective}
O: ${state.soap.objective}
A: ${state.soap.assessment}
P (hiện tại): ${state.soap.plan}

YÊU CẦU:
1. Xác định các chẩn đoán phân biệt có thể.
2. Gợi ý xét nghiệm/chẩn đoán hình ảnh cần làm để xác định chẩn đoán.
3. Đưa ra hướng điều trị sơ bộ.
4. Khi nào cần chuyển chuyên khoa.

LƯU Ý: Tất cả phải bằng TIẾNG VIỆT.`;

        try {
            const adviceContent = await ollamaChat(
                [{ role: 'user', content: prompt }],
                { temperature: 0.3 },
            );

            return {
                medicalAdvice: `📌 **Lưu ý**: Không tìm thấy phác đồ điều trị cụ thể trong cơ sở dữ liệu. Dưới đây là gợi ý dựa trên kiến thức y khoa chung.\n\n${adviceContent}`,
                references: ['Kiến thức y khoa chung'],
            };
        } catch (error) {
            this.logger.error('❌ General advice generation failed:', error);
            return {
                medicalAdvice: 'Không thể tạo gợi ý điều trị.',
                references: [],
            };
        }
    }
}
