import { Injectable, Logger } from '@nestjs/common';
import { AgentState } from '../graph/agent.state';
import { VectorStoreService } from '../../rag/vectorstore.service';
import { Document } from '@langchain/core/documents';
import { getGroqClient, GROQ_MODEL_STANDARD, GROQ_MODEL_EXPERT } from '../models/groq.models';

/**
 * Agent Nodes Service
 * 
 * Contains the implementation of each AI agent node in the LangGraph workflow.
 * Each node receives the current state and returns partial state updates.
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
        this.logger.log('📝 Scribe Agent working (Groq GPT-OSS-120B)...');

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
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.1,
                response_format: { type: 'json_object' },
            });

            const soap = JSON.parse(
                completion.choices[0]?.message?.content || '{}',
            );

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
        this.logger.log('🏷️ ICD-10 Agent working (Groq GPT-OSS-120B)...');

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
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.1,
                response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content || '{}';
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
                    description: 'Lỗi lấy mã ICD-10',
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
        this.logger.log('🧑‍⚕️ Medical Expert Agent working (Groq + RAG)...');

        try {
            // Check if RAG is available
            if (!this.vectorStoreService.isReady()) {
                this.logger.warn('⚠️ RAG not available, skipping expert advice');
                return {
                    medicalAdvice: 'RAG knowledge base not available.',
                    references: [],
                };
            }

            // 1. Retrieve relevant docs based on Subjective
            const retriever = this.vectorStoreService.getRetriever();
            const docs = await retriever.invoke(state.soap.subjective);

            const context = docs.map((d: Document) => d.pageContent).join('\n---\n');
            const references = docs.map((d: Document) =>
                (d.metadata.source || 'Unknown Source').replace('.md', ''),
            );

            // 2. Ask LLM with Context
            const prompt = `Bạn là chuyên gia y tế cố vấn. TẤT CẢ PHẢN HỒI PHẢI BẰNG TIẾNG VIỆT.
Dựa vào Y VĂN ĐƯỢC CUNG CẤP dưới đây, hãy đưa ra nhận xét và gợi ý điều trị.

Y VĂN (Context):
${context}

BỆNH ÁN (SOAP):
S: ${state.soap.subjective}
O: ${state.soap.objective}
A: ${state.soap.assessment}
P (hiện tại): ${state.soap.plan}

YÊU CẦU (PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT):
- Đưa ra lời khuyên ngắn gọn cho bác sĩ điều trị.
- Cảnh báo nếu phác đồ hiện tại (Plan) có gì sai sót hoặc không phù hợp so với Y VĂN.
- Gợi ý xét nghiệm/chẩn đoán hình ảnh cần làm thêm (nếu cần).
- Gợi ý điều trị và quản lý bệnh nhân.
- Khi nào cần can thiệp chuyên khoa.
- TRÍCH DẪN từ y văn (nếu có).

LƯU Ý QUAN TRỌNG: 
- KHÔNG dùng tiếng Anh. 
- Tất cả tiêu đề, nội dung phải hoàn toàn bằng TIẾNG VIỆT.`;

            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: GROQ_MODEL_EXPERT,
                temperature: 0.2,
            });

            this.logger.log(`✅ Expert Agent completed with ${references.length} references`);
            return {
                medicalAdvice: completion.choices[0]?.message?.content || '',
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
}
