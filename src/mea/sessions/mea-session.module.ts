import { Module } from '@nestjs/common';
import { MeaSessionController } from './mea-session.controller';
import { MeaSessionService } from './mea-session.service';
import { PrismaModule } from '../../prisma';

/**
 * MEA Session Module
 * 
 * Manages examination sessions.
 */
@Module({
    imports: [PrismaModule],
    controllers: [MeaSessionController],
    providers: [MeaSessionService],
    exports: [MeaSessionService],
})
export class MeaSessionModule { }
