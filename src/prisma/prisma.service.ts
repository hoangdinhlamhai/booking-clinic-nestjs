import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            // Optimize for low memory VPS
            log: process.env.NODE_ENV === 'production'
                ? ['error', 'warn']
                : ['query', 'info', 'warn', 'error'],
            // Connection pool settings for low memory
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
            this.logger.log('✅ Prisma connected to database');
        } catch (error) {
            this.logger.error('❌ Failed to connect to database:', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Prisma disconnected from database');
    }

    // Helper method to handle graceful shutdown
    async enableShutdownHooks() {
        process.on('beforeExit', async () => {
            await this.$disconnect();
        });
    }
}
