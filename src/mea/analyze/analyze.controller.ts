import { Controller, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';

/**
 * Analyze Controller
 * 
 * Endpoints for AI analysis of medical transcripts.
 */
@Controller('mea/analyze')
export class AnalyzeController {
    private readonly logger = new Logger(AnalyzeController.name);

    constructor(private readonly analyzeService: AnalyzeService) { }

    /**
     * Analyze a transcript and generate SOAP notes, ICD codes, etc.
     * 
     * POST /mea/analyze
     * Body: { transcript: string }
     */
    @Post()
    async analyze(@Body() body: { transcript: string }) {
        if (!body.transcript || body.transcript.trim().length === 0) {
            throw new BadRequestException('Transcript is required');
        }

        this.logger.log(`📝 Received transcript: ${body.transcript.substring(0, 50)}...`);

        const result = await this.analyzeService.processTranscript(body.transcript);

        return {
            success: true,
            data: result,
        };
    }
}
