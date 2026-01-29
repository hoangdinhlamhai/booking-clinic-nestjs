import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ComparisonAgentService } from './comparison-agent.service';
import { SubmitComparisonDto } from './dto/comparison.dto';

/**
 * Comparison Service
 * 
 * Manages comparison records in the database.
 * Uses Prisma instead of Drizzle (adapted from MEA).
 */
@Injectable()
export class ComparisonService {
    private readonly logger = new Logger(ComparisonService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly comparisonAgentService: ComparisonAgentService,
    ) { }

    /**
     * Submit comparison for analysis
     * 
     * @param data Comparison data with AI and Doctor results
     * @returns Comparison record with analysis
     */
    async submitComparison(data: SubmitComparisonDto) {
        this.logger.log('📊 Submitting comparison for analysis...');

        // Run AI Comparison Analysis
        const analysis = await this.comparisonAgentService.compareMedicalResults(
            data.aiResults.soap,
            data.doctorResults.soap,
            data.aiResults.icdCodes,
            data.doctorResults.icdCodes,
        );

        // Save to Database using Prisma
        const result = await this.prisma.comparisonRecord.create({
            data: {
                sessionId: data.sessionId || null,
                medicalRecordId: data.medicalRecordId || null,
                aiResults: data.aiResults as any,
                doctorResults: data.doctorResults as any,
                comparison: analysis as any,
                matchScore: analysis.matchScore,
            },
        });

        this.logger.log(`✅ Comparison saved with ID: ${result.id}`);

        return {
            comparisonId: result.id,
            matchScore: analysis.matchScore,
            analysis,
        };
    }

    /**
     * Get comparison record by session ID
     */
    async getComparisonBySession(sessionId: string) {
        return this.prisma.comparisonRecord.findFirst({
            where: { sessionId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get comparison record by ID
     */
    async getComparisonById(id: string) {
        return this.prisma.comparisonRecord.findUnique({
            where: { id },
        });
    }

    /**
     * Get all comparison records with pagination
     */
    async getComparisons(page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        const [records, total] = await Promise.all([
            this.prisma.comparisonRecord.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    session: true,
                    medicalRecord: true,
                },
            }),
            this.prisma.comparisonRecord.count(),
        ]);

        return {
            data: records,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
