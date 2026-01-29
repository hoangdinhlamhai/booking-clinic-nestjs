import { Module } from '@nestjs/common';
import { SttController } from './stt.controller';
import { SttService } from './stt.service';

/**
 * Speech-to-Text Module
 * 
 * Provides audio transcription with:
 * - Whisper STT (via Groq)
 * - Speaker role detection
 * - Medical terminology correction
 */
@Module({
    controllers: [SttController],
    providers: [SttService],
    exports: [SttService],
})
export class SttModule { }
