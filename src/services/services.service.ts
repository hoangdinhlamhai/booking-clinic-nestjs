import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class ServicesService {
    constructor(private prisma: PrismaService) { }

    async findAll(): Promise<{ id: string; name: string }[]> {
        const services = await this.prisma.service.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return services;
    }
}
