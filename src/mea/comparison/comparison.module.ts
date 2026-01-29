import { Module } from '@nestjs/common';
import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { ComparisonAgentService } from './comparison-agent.service';
import { RagModule } from '../rag/rag.module';
import { PrismaModule } from '../../prisma';

/**
 * Comparison Module
 * 
 * Provides AI vs Doctor comparison functionality.
 */
@Module({
    imports: [RagModule, PrismaModule],
    controllers: [ComparisonController],
    providers: [ComparisonService, ComparisonAgentService],
    exports: [ComparisonService],
})
export class ComparisonModule { }
