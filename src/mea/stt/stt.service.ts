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
        mimeType: string = 'audio/webm',
    ): Promise<{ text: string; segments: TranscriptSegment[] }> {
        const formData = new FormData();
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(audioBlob);

        // Determine file extension from mime type
        const extensionMap: Record<string, string> = {
            'audio/webm': 'webm',
            'audio/mp4': 'm4a',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/flac': 'flac',
        };
        const extension = extensionMap[mimeType] || 'webm';
        const filename = `recording.${extension}`;

        this.logger.log(`🎵 Processing audio: ${mimeType} → ${filename}`);

        const blob = new Blob([uint8Array], { type: mimeType });
        formData.append('file', blob, filename);
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
            const errorText = await response.text();
            this.logger.error(`Groq API error: ${response.status} - ${errorText}`);
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
            // Filter and clean segments
            const cleaned = transcription.segments
                .map((seg) => ({
                    role: 'Người nói',
                    raw_text: this.removeNoise(seg.text),
                    start: seg.start,
                    end: seg.end,
                }))
                .filter((seg) => seg.raw_text.trim().length > 0); // Remove empty segments

            // Merge very short consecutive segments (< 3 words) for better context
            return this.mergeShortSegments(cleaned);
        }

        // Fallback if no segments
        if (transcription.text) {
            return [
                {
                    role: 'Người nói',
                    raw_text: this.removeNoise(transcription.text),
                    start: 0,
                    end: 0,
                },
            ];
        }

        return [];
    }

    /**
     * Remove noise, filler words, and clean up STT artifacts
     */
    private removeNoise(text: string): string {
        if (!text) return '';

        let cleaned = text;

        // Vietnamese filler words and hesitations
        const fillerPatterns = [
            /\b(ừ+|ờ+|à+|ạ+|ơ+|uh+|um+|hmm+|hm+)\b/gi,
            /\b(thì là|là thì|cái này|cái kia|như là|kiểu như)\b/gi,
            /\b(ấy|đấy|này|kia|đó mà|thế thì|vậy thì)\b/gi,
            // Repeated single letters (stuttering)
            /\b([a-zA-ZÀ-ỹ])\1{2,}\b/gi,
        ];

        for (const pattern of fillerPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        // Remove repeated words (e.g., "đau đau đau" -> "đau")
        cleaned = cleaned.replace(/\b(\S+)(\s+\1)+\b/gi, '$1');

        // Remove excessive punctuation
        cleaned = cleaned.replace(/[.]{2,}/g, '.');
        cleaned = cleaned.replace(/[,]{2,}/g, ',');

        // Clean up multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // Remove leading/trailing punctuation artifacts
        cleaned = cleaned.replace(/^[,.\s]+|[,.\s]+$/g, '');

        return cleaned;
    }

    /**
     * Merge very short consecutive segments for better role detection context
     * Segments < 3 words are merged with the next segment
     */
    private mergeShortSegments(
        segments: { role: string; raw_text: string; start: number; end: number }[],
    ): { role: string; raw_text: string; start: number; end: number }[] {
        if (segments.length <= 1) return segments;

        const merged: typeof segments = [];
        let buffer: typeof segments[0] | null = null;

        for (const seg of segments) {
            const wordCount = seg.raw_text.split(/\s+/).length;

            if (buffer) {
                // Append to buffer
                buffer = {
                    role: buffer.role,
                    raw_text: `${buffer.raw_text} ${seg.raw_text}`.trim(),
                    start: buffer.start,
                    end: seg.end,
                };

                // If combined is long enough, push to result
                if (buffer.raw_text.split(/\s+/).length >= 3) {
                    merged.push(buffer);
                    buffer = null;
                }
            } else if (wordCount < 3) {
                // Start buffering short segment
                buffer = { ...seg };
            } else {
                // Long enough, push directly
                merged.push(seg);
            }
        }

        // Don't forget remaining buffer
        if (buffer) {
            merged.push(buffer);
        }

        return merged;
    }

    /**
     * Use LLM to analyze content and detect speaker roles
     * Enhanced with turn-taking analysis and Vietnamese medical context
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

        const prompt = `Bạn là chuyên gia phân tích hội thoại khám bệnh tiếng Việt với độ chính xác cao.

## NHIỆM VỤ
Phân tích transcript cuộc khám bệnh và xác định CHÍNH XÁC vai trò người nói cho TỪNG đoạn.

## QUY TẮC PHÂN LOẠI (QUAN TRỌNG)

### BÁC SĨ thường:
- Hỏi câu hỏi khám bệnh: "có đau không?", "bị bao lâu rồi?", "có sốt không?"
- Dùng ngôn ngữ chuyên môn: "triệu chứng", "chẩn đoán", "kê đơn"
- Ra chỉ định: "uống thuốc...", "tái khám...", "xét nghiệm..."
- Xưng hô: "tôi", "bác sĩ", hoặc không xưng
- Giọng điệu: chủ động hỏi, ra lệnh, giải thích

### BỆNH NHÂN thường:
- Chào hỏi bác sĩ: "chào bác sĩ", "dạ bác sĩ"
- Mô tả triệu chứng: "em/tôi bị...", "em/tôi đau...", "em/tôi thấy..."
- Trả lời câu hỏi: "dạ", "vâng", "không ạ", "có ạ"
- Xưng hô: "em", "con", "cháu", "tôi" + trả lời
- Giọng điệu: thụ động, trả lời, mô tả cảm giác cá nhân

### MANH MỐI BỔ SUNG:
- Câu hỏi thường là BÁC SĨ (trừ "bác sĩ ơi em...?")
- Câu bắt đầu bằng "Dạ", "Vâng", "Không ạ" thường là BỆNH NHÂN
- Turn-taking: thường xen kẽ (BS hỏi → BN trả lời → BS hỏi tiếp)
- Nếu không rõ, dựa vào ngữ cảnh câu trước/sau

## HỘI THOẠI CẦN PHÂN TÍCH:
${conversationText}

## YÊU CẦU OUTPUT:
Trả về CHÍNH XÁC JSON array, mỗi phần tử có:
- "index": số thứ tự đoạn (0, 1, 2...)
- "role": "Bác sĩ" hoặc "Bệnh nhân"
- "confidence": 0.0-1.0 (độ tin cậy)

Ví dụ: [{"index": 0, "role": "Bác sĩ", "confidence": 0.95}, {"index": 1, "role": "Bệnh nhân", "confidence": 0.9}]

CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC.`;

        try {
            this.logger.debug('🔍 Analyzing speaker roles with enhanced prompt...');

            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.05, // Lower for more consistent results
            });

            const responseText = completion.choices[0]?.message?.content || '';
            this.logger.debug(`Role detection response: ${responseText.substring(0, 200)}...`);

            // Extract JSON
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                this.logger.warn('LLM did not return valid JSON, applying heuristic fallback');
                return this.applyHeuristicRoles(segments);
            }

            const roleAssignments: { index: number; role: string; confidence?: number }[] = JSON.parse(
                jsonMatch[0],
            );

            // Update segments with new roles from LLM
            const updatedSegments = segments.map((seg, i) => {
                const assignment = roleAssignments.find((r) => r.index === i);
                if (assignment) {
                    this.logger.debug(`Segment ${i}: "${seg.raw_text.substring(0, 30)}..." → ${assignment.role} (${assignment.confidence || 'N/A'})`);
                    return { ...seg, role: assignment.role };
                }
                return seg;
            });

            this.logger.debug('✅ LLM role detection completed successfully');
            return updatedSegments;
        } catch (error) {
            this.logger.error('❌ LLM role detection error:', error);
            // Fallback: apply heuristic rules
            return this.applyHeuristicRoles(segments);
        }
    }

    /**
     * Heuristic-based role detection fallback
     * Uses keyword patterns when LLM fails
     */
    private applyHeuristicRoles(
        segments: { role: string; raw_text: string; start: number; end: number }[],
    ): { role: string; raw_text: string; start: number; end: number }[] {
        const doctorPatterns = [
            /\b(có đau|bị đau|đau ở|đau bao|bao lâu|mấy ngày|sốt không|ho không|uống thuốc|tái khám|xét nghiệm|chẩn đoán|kê đơn|điều trị)\b/i,
            /\?([\s]*$)/,  // Ends with question mark
            /\b(bệnh nhân|anh|chị|em|bạn) (có|bị|thấy|cảm thấy)/i,
        ];

        const patientPatterns = [
            /^(dạ|vâng|không ạ|có ạ|chào bác|bác sĩ ơi)/i,
            /\b(em bị|tôi bị|con bị|cháu bị|em đau|tôi đau|em thấy|tôi thấy)\b/i,
            /\b(được \d+ ngày|được mấy|từ hôm|hôm qua|tuần trước)\b/i,
        ];

        return segments.map((seg, i) => {
            const text = seg.raw_text.toLowerCase();

            let doctorScore = 0;
            let patientScore = 0;

            for (const pattern of doctorPatterns) {
                if (pattern.test(text)) doctorScore++;
            }
            for (const pattern of patientPatterns) {
                if (pattern.test(text)) patientScore++;
            }

            // If scores are equal, alternate based on position (assume doctor starts)
            let role = 'Người nói';
            if (doctorScore > patientScore) {
                role = 'Bác sĩ';
            } else if (patientScore > doctorScore) {
                role = 'Bệnh nhân';
            } else {
                // Fallback: alternate (even = Doctor, odd = Patient)
                role = i % 2 === 0 ? 'Bác sĩ' : 'Bệnh nhân';
            }

            return { ...seg, role };
        });
    }

    /**
     * Vietnamese medical abbreviation/fast-speech dictionary
     * Maps common STT errors to correct medical terms
     */
    private readonly medicalDictionary: Record<string, string> = {
        // Phát âm sai thường gặp
        'đau thượng vịt': 'đau thượng vị',
        'bị sụp': 'bị sốt',
        'bị xốp': 'bị sốt',
        'ăn chích': 'ăn kiêng',
        'tiêu chuẩn': 'triệu chứng',
        'tiểu chứng': 'triệu chứng',
        'triểu chứng': 'triệu chứng',
        'chấn đoán': 'chẩn đoán',
        'chẩm đoán': 'chẩn đoán',
        'vện phổi': 'viêm phổi',
        'viên phổi': 'viêm phổi',
        'vêm phổi': 'viêm phổi',
        'viêm phỗi': 'viêm phổi',
        'viêm họn': 'viêm họng',
        'viêm hông': 'viêm họng',
        'ho khan': 'ho khan',
        'hô khan': 'ho khan',
        'nhứt đầu': 'nhức đầu',
        'nhắc đầu': 'nhức đầu',
        'đau bụn': 'đau bụng',
        'đau bụnh': 'đau bụng',
        'đâu bụng': 'đau bụng',
        'tiểu đưởng': 'tiểu đường',
        'tiêu đường': 'tiểu đường',
        'tiểu dường': 'tiểu đường',
        'huyện áp': 'huyết áp',
        'huyệt áp': 'huyết áp',
        'huyết ắp': 'huyết áp',
        'tim mạch': 'tim mạch',
        'tin mạch': 'tim mạch',
        'thư giản': 'thư giãn',
        'thư dản': 'thư giãn',
        'sổ mũi': 'sổ mũi',
        'xổ mũi': 'sổ mũi',
        'sô mũi': 'sổ mũi',

        // Viết tắt y khoa phổ biến
        'bs': 'bác sĩ',
        'bn': 'bệnh nhân',
        'bt': 'bình thường',
        'tc': 'triệu chứng',
        'cđ': 'chẩn đoán',
        'xn': 'xét nghiệm',
        'xq': 'X-quang',
        'ct': 'CT scan',
        'mri': 'MRI',
        'ecg': 'điện tim',
        'ekg': 'điện tim',

        // Từ nói nhanh/nuốt âm
        'đưc': 'được',
        'đc': 'được',
        'ko': 'không',
        'k0': 'không',
        'khg': 'không',
        'đag': 'đang',
        'ng': 'người',
        'ngta': 'người ta',
        'vs': 'với',
        'v': 'vâng',
        'r': 'rồi',
        'chx': 'chưa',
        'cx': 'cũng',
        'trc': 'trước',
        'ns': 'nói',
        'đi': 'đi',

        // Thuốc thường gặp
        'para': 'Paracetamol',
        'paracé': 'Paracetamol',
        'ibu': 'Ibuprofen',
        'amô': 'Amoxicillin',
        'amox': 'Amoxicillin',
        'kháng xin': 'kháng sinh',
        'kan sinh': 'kháng sinh',
        'giam đau': 'giảm đau',
        'giàm đau': 'giảm đau',
    };

    /**
     * Pre-process text with dictionary replacements
     */
    private preProcessWithDictionary(text: string): string {
        let result = text;

        // Sort by length (longer first) to avoid partial replacements
        const sortedKeys = Object.keys(this.medicalDictionary)
            .sort((a, b) => b.length - a.length);

        for (const key of sortedKeys) {
            const regex = new RegExp(key, 'gi');
            result = result.replace(regex, this.medicalDictionary[key]);
        }

        return result;
    }

    /**
     * Use LLM to fix medical terminology errors
     * Enhanced with context-aware prediction for abbreviations and fast speech
     */
    async fixMedicalText(text: string): Promise<string> {
        if (!text || text.trim().length === 0) return text;

        // Step 1: Pre-process with dictionary
        const preprocessed = this.preProcessWithDictionary(text);
        this.logger.debug(`Dictionary pre-process: "${text}" → "${preprocessed}"`);

        try {
            const groq = getGroqClient();
            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Bạn là chuyên gia hiệu chỉnh văn bản y khoa tiếng Việt từ Speech-to-Text.

## NHIỆM VỤ
Sửa lỗi chính tả, phát âm sai, từ viết tắt, và từ bị nuốt âm do nói nhanh trong ngữ cảnh y khoa.

## QUY TẮC BẮT BUỘC
1. GIỮ NGUYÊN ý nghĩa và cấu trúc câu gốc
2. KHÔNG thêm nội dung mới
3. KHÔNG xóa nội dung
4. CHỈ sửa lỗi, không viết lại câu

## CÁC LOẠI LỖI CẦN SỬA

### Lỗi phát âm (do giọng địa phương hoặc nói nhanh):
- "đau thượng vịt/vít" → "đau thượng vị"
- "bị sụp/xốp" → "bị sốt"
- "triểu/tiểu chứng" → "triệu chứng"
- "vện/viên phổi" → "viêm phổi"
- "huyện/huyệt áp" → "huyết áp"
- "tiểu đưởng/dường" → "tiểu đường"

### Từ viết tắt/nuốt âm:
- "đc/đưc" → "được"
- "ko/khg" → "không"
- "bt" → "bình thường"
- "xn" → "xét nghiệm"
- "para/paracé" → "Paracetamol"
- "kháng xin/kan sinh" → "kháng sinh"

### Sửa trong ngữ cảnh:
- Nếu nghe "em bị xốp 2 ngày" → sửa thành "em bị sốt 2 ngày"
- Nếu nghe "triểu chứng đau đầu" → sửa thành "triệu chứng đau đầu"
- Dựa vào ngữ cảnh y khoa để chọn từ phù hợp

## OUTPUT
Trả về CHÍNH XÁC đoạn văn đã sửa lỗi, KHÔNG giải thích hay thêm bất kỳ text nào khác.`,
                    },
                    { role: 'user', content: preprocessed },
                ],
                model: GROQ_MODEL_STANDARD,
                temperature: 0.02, // Very low for consistent corrections
            });

            // Add artificial delay to respect rate limits if calling in loop
            await new Promise((resolve) => setTimeout(resolve, 150));

            const result = completion.choices[0]?.message?.content || preprocessed;
            this.logger.debug(`LLM fix: "${preprocessed}" → "${result}"`);

            return result;
        } catch (error) {
            this.logger.error('❌ Medical fixer error:', error);
            // Return preprocessed text (dictionary-only fixes)
            return preprocessed;
        }
    }

    /**
     * Main processing method - orchestrates entire STT pipeline
     * Flow: Whisper STT → LLM Role Detection → Medical Text Fixer
     * 
     * @param audioBuffer Audio file buffer
     * @param mimeType Audio MIME type (e.g., 'audio/webm', 'audio/wav')
     * @returns Processed segments with roles and cleaned text
     */
    async processAudioFile(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<SttProcessingResult> {
        try {
            this.logger.log(`🎤 Received audio: ${audioBuffer.length} bytes (${mimeType})`);

            // Step 1: Whisper STT - Convert audio to text
            this.logger.log('🔊 Running Whisper STT...');
            const transcription = await this.transcribeWithGroq(audioBuffer, mimeType);
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
