import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { AgentsModule } from '../agents/agents.module';

/**
 * Analyze Module
 * 
 * Provides the transcript analysis API that uses AI agents.
 */
@Module({
    imports: [AgentsModule],
    controllers: [AnalyzeController],
    providers: [AnalyzeService],
    exports: [AnalyzeService],
})
export class AnalyzeModule { }
