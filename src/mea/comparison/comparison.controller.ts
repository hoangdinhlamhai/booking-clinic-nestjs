import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { ComparisonService } from './comparison.service';
import { SubmitComparisonDto } from './dto/comparison.dto';

/**
 * Comparison Controller
 * 
 * Endpoints for AI vs Doctor comparison analysis.
 */
@Controller('mea/comparison')
export class ComparisonController {
    private readonly logger = new Logger(ComparisonController.name);

    constructor(private readonly comparisonService: ComparisonService) { }

    /**
     * Submit a comparison for analysis
     * 
     * POST /mea/comparison
     */
    @Post()
    async submitComparison(@Body() dto: SubmitComparisonDto) {
        if (!dto.aiResults || !dto.doctorResults) {
            throw new BadRequestException('Both aiResults and doctorResults are required');
        }

        this.logger.log('📊 Received comparison submission');
        return this.comparisonService.submitComparison(dto);
    }

    /**
     * Get comparison by ID
     * 
     * GET /mea/comparison/:id
     */
    @Get(':id')
    async getComparisonById(@Param('id') id: string) {
        const comparison = await this.comparisonService.getComparisonById(id);
        if (!comparison) {
            throw new BadRequestException('Comparison not found');
        }
        return comparison;
    }

    /**
     * Get comparison by session ID
     * 
     * GET /mea/comparison/session/:sessionId
     */
    @Get('session/:sessionId')
    async getComparisonBySession(@Param('sessionId') sessionId: string) {
        return this.comparisonService.getComparisonBySession(sessionId);
    }

    /**
     * Get all comparisons with pagination
     * 
     * GET /mea/comparison?page=1&limit=20
     */
    @Get()
    async getComparisons(
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        return this.comparisonService.getComparisons(
            parseInt(page, 10),
            parseInt(limit, 10),
        );
    }
}
