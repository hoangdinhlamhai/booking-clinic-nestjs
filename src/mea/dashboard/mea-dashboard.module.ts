import { Module } from '@nestjs/common';
import { MeaDashboardController } from './mea-dashboard.controller';
import { MeaDashboardService } from './mea-dashboard.service';
import { PrismaModule } from '../../prisma';

/**
 * MEA Dashboard Module
 * 
 * Provides dashboard statistics and data.
 */
@Module({
    imports: [PrismaModule],
    controllers: [MeaDashboardController],
    providers: [MeaDashboardService],
    exports: [MeaDashboardService],
})
export class MeaDashboardModule { }
