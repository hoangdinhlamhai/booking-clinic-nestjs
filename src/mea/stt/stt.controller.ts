import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SttService } from './stt.service';

/**
 * STT Controller
 * 
 * Handles audio file uploads for speech-to-text processing.
 */
@Controller('mea/stt')
export class SttController {
    private readonly logger = new Logger(SttController.name);

    constructor(private readonly sttService: SttService) { }

    /**
     * Process uploaded audio file
     * 
     * POST /mea/stt/process
     * Content-Type: multipart/form-data
     * Body: { audio: <file> }
     */
    @Post('process')
    @UseInterceptors(FileInterceptor('audio'))
    async processAudio(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Audio file is required');
        }

        this.logger.log(`📁 Received file: ${file.originalname} (${file.size} bytes)`);

        const result = await this.sttService.processAudioFile(file.buffer);

        return {
            success: result.success,
            data: {
                segments: result.segments,
                rawText: result.raw_text,
                numSpeakers: result.num_speakers,
            },
        };
    }

    /**
     * Health check for STT service
     * 
     * GET /mea/stt/health
     */
    @Post('health')
    healthCheck() {
        return {
            status: 'ok',
            service: 'STT',
            timestamp: new Date().toISOString(),
        };
    }
}
