import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma';

@Injectable()
export class ClinicsService {
    constructor(private prisma: PrismaService) { }

    async findAll(): Promise<{ id: string; name: string }[]> {
        const clinics = await this.prisma.clinic.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc',
            },
        });

        return clinics;
    }
}
