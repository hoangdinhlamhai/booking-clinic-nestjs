import { Injectable, Logger } from '@nestjs/common';
import { getGroqClient, GROQ_MODEL_STANDARD } from '../agents/models/groq.models';
import {
    TranscriptSegment,
    ProcessedSegment,
    SttProcessingResult,
} from './dto/stt-response.dto';

/**
 * Speech-to-Text Service
 * 
 * Processes audio recordings through a pipeline:
 * 1. Whisper STT (Groq) - Audio → Text
 * 2. LLM Role Detection - Identify Doctor vs Patient
 * 3. Medical Text Fixer - Fix pronunciation errors in medical terms
 */
@Injectable()
export class SttService {
    private readonly logger = new Logger(SttService.name);

    /**
     * Call Groq Whisper API to transcribe audio to text
     * 
     * @param audioBlob Audio buffer (WAV, MP3, etc.)
     * @returns Transcription with text and segments
     */
    async transcribeWithGroq(
        audioBlob: Buffer,
    ): Promise<{ text: string; segments: TranscriptSegment[] }> {
        const formData = new FormData();
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(audioBlob);
        const blob = new Blob([uint8Array], { type: 'audio/wav' });
        formData.append('file', blob, 'recording.wav');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'vi');
        formData.append('response_format', 'verbose_json');

        const response = await fetch(
            'https://api.groq.com/openai/v1/audio/transcriptions',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
                body: formData,
            },
        );

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            text: data.text || '',
            segments: data.segments || [],
        };
    }

    /**
     * Prepare transcription segments for LLM role detection
     */
    prepareSegmentsForRoleDetection(transcription: {
        text: string;
        segments: TranscriptSegment[];
    }): { role: string; raw_text: string; start: number; end: number }[] {
        if (transcription.segments.length > 0) {
            return transcription.segments.map((seg) => ({
                role: 'Người nói', // Placeholder - LLM will determine actual role
                raw_text: seg.text,
                start: seg.start,
                end: seg.end,
            }));
        }

        // Fallback if no segments
        if (transcription.text) {
            return [
                {
                    role: 'Người nói',
                    raw_text: transcription.text,
                    start: 0,
                    end: 0,
                },
            ];
        }

        return [];
    }

    /**
     * Use LLM to analyze content and detect speaker roles
     * Based on conversation context to determine who is Doctor vs Patient
     */
    async detectSpeakerRoleByContent(
        segments: { role: string; raw_text: string; start: number; end: number }[],
    ): Promise<
        { role: string; raw_text: string; start: number; end: number }[]
    > {
        if (segments.length === 0) return segments;

        // Create prompt with all segments
        const conversationText = segments
            .map((seg, i) => `[${i}] "${seg.raw_text.trim()}"`)
            .join('\n');

        const prompt = `Bạn là chuyên gia phân tích hội thoại y khoa tiếng Việt.
Dưới đây là transcript cuộc khám bệnh. Hãy xác định vai trò người nói cho từng đoạn.

QUY TẮC XÁC ĐỊNH VAI TRÒ:
- BÁC SĨ: Hỏi triệu chứng, hỏi bệnh sử, đưa ra chẩn đoán, kê đơn thuốc, hướng dẫn điều trị
- BỆNH NHÂN: Mô tả triệu chứng ("tôi bị...", "tôi thấy..."), xưng "chào bác sĩ", trả lời câu hỏi về bản thân

MANH MỐI QUAN TRỌNG:
- Ai nói "Chào bác sĩ" → BỆNH NHÂN
- Ai hỏi "bạn/anh/chị có triệu chứng gì?" → BÁC SĨ  
- Ai mô tả "tôi đau...", "tôi bị..." → BỆNH NHÂN
- Ai hỏi "có sốt không?", "uống thuốc gì chưa?" → BÁC SĨ

HỘI THOẠI:
${conversationText}

Trả về CHÍNH XÁC định dạng JSON array sau, KHÔNG có text khác:
[{"index": 0, "role": "Bác sĩ"}, {"index": 1, "role": "Bệnh nhân"}, ...]`;

        try {
            this.logger.debug('🔍 Analyzing speaker roles with Groq...');

            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.1,
            });

            const responseText = completion.choices[0]?.message?.content || '';

            // Extract JSON
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                this.logger.warn('LLM did not return valid JSON, keeping original roles');
                return segments;
            }

            const roleAssignments: { index: number; role: string }[] = JSON.parse(
                jsonMatch[0],
            );

            // Update segments with new roles from LLM
            const updatedSegments = segments.map((seg, i) => {
                const assignment = roleAssignments.find((r) => r.index === i);
                if (assignment) {
                    return { ...seg, role: assignment.role };
                }
                return seg;
            });

            this.logger.debug('✅ LLM role detection completed');
            return updatedSegments;
        } catch (error) {
            this.logger.error('❌ LLM role detection error:', error);
            // Fallback: keep original roles
            return segments;
        }
    }

    /**
     * Use LLM to fix medical terminology errors
     * ONLY fixes typos, does NOT add new content
     */
    async fixMedicalText(text: string): Promise<string> {
        if (!text || text.trim().length === 0) return text;

        try {
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Bạn là chuyên gia hiệu chỉnh văn bản y khoa tiếng Việt.
NHIỆM VỤ: Chỉ sửa lỗi chính tả và phát âm sai trong đoạn văn được chuyển từ giọng nói.

QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG thêm nội dung mới
2. TUYỆT ĐỐI KHÔNG xóa bớt nội dung
3. TUYỆT ĐỐI KHÔNG viết lại câu
4. Chỉ sửa lỗi phát âm thường gặp:
   - "đau thượng vịt" → "đau thượng vị"
   - "bị sụp" → "bị sốt"  
   - "ăn chích" → "ăn kiêng"
   - "tiêu chuẩn" → "triệu chứng"
5. Giữ nguyên số từ và ý nghĩa gốc
6. Trả về CHÍNH XÁC đoạn văn gốc với lỗi đã sửa, KHÔNG trả lời hay giải thích thêm.`,
                    },
                    { role: 'user', content: text },
                ],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.05,
            });

            // Add artificial delay to respect rate limits if calling in loop
            await new Promise((resolve) => setTimeout(resolve, 200));

            return completion.choices[0]?.message?.content || text;
        } catch (error) {
            this.logger.error('❌ Medical fixer error:', error);
            return text;
        }
    }

    /**
     * Main processing method - orchestrates entire STT pipeline
     * Flow: Whisper STT → LLM Role Detection → Medical Text Fixer
     * 
     * @param audioBuffer Audio file buffer
     * @returns Processed segments with roles and cleaned text
     */
    async processAudioFile(audioBuffer: Buffer): Promise<SttProcessingResult> {
        try {
            this.logger.log(`🎤 Received audio: ${audioBuffer.length} bytes`);

            // Step 1: Whisper STT - Convert audio to text
            this.logger.log('🔊 Running Whisper STT...');
            const transcription = await this.transcribeWithGroq(audioBuffer);
            this.logger.log(`📝 Transcription: ${transcription.text.substring(0, 100)}...`);
            this.logger.debug(`📊 Segments count: ${transcription.segments.length}`);

            // If no text, return empty
            if (!transcription.text || transcription.text.trim().length === 0) {
                return {
                    success: true,
                    segments: [],
                    raw_text: '',
                    num_speakers: 0,
                };
            }

            // Step 2: Prepare segments for role detection
            const preparedSegments =
                this.prepareSegmentsForRoleDetection(transcription);
            this.logger.debug(`✅ Prepared segments: ${preparedSegments.length}`);

            // Step 3: LLM Role Detection - Analyze content to determine Doctor/Patient
            const segmentsWithRoles =
                await this.detectSpeakerRoleByContent(preparedSegments);

            // Step 4: Medical Text Fixer - Fix medical terminology errors
            this.logger.log('🩺 Running Medical Text Fixer...');
            const processedSegments: ProcessedSegment[] = [];
            for (const seg of segmentsWithRoles) {
                const clean_text = await this.fixMedicalText(seg.raw_text);
                processedSegments.push({
                    ...seg,
                    clean_text,
                });
            }

            this.logger.log('✅ STT Processing complete!');

            return {
                success: true,
                segments: processedSegments,
                raw_text: transcription.text,
                num_speakers: 2, // Assumed 2 speakers (Doctor + Patient)
            };
        } catch (error) {
            this.logger.error('❌ STT Processing error:', error);
            throw error;
        }
    }
}
