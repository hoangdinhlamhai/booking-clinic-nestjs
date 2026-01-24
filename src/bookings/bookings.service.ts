import {
    Injectable,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma';
import { CreateBookingDto, BookingResponse } from './dto';

@Injectable()
export class BookingsService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    /**
     * Check if booking is expired (default 5 minutes)
     */
    private isExpired(createdAt: Date, minutes = 5): boolean {
        const created = createdAt.getTime();
        return Date.now() - created > minutes * 60 * 1000;
    }

    /**
     * Extract user info from Authorization header
     */
    extractUserFromToken(authHeader: string): { userId?: string; email?: string } {
        if (!authHeader?.startsWith('Bearer ')) {
            return {};
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = this.jwtService.verify(token);
            return {
                userId: decoded.userId,
                email: decoded.email,
            };
        } catch {
            return {};
        }
    }

    /**
     * Create a new booking
     */
    async createBooking(
        createBookingDto: CreateBookingDto,
        userId?: string,
    ): Promise<{ bookingId: string }> {
        try {
            // Create booking
            const booking = await this.prisma.booking.create({
                data: {
                    userId: userId ?? null,
                    clinicId: createBookingDto.clinic,
                    serviceId: createBookingDto.service,
                    patientName: createBookingDto.name,
                    patientPhone: createBookingDto.phone,
                    gender: createBookingDto.gender ?? null,
                    age: createBookingDto.age ?? null,
                    symptoms: createBookingDto.symptoms ?? null,
                    bookingTime: new Date(createBookingDto.booking_time),
                    status: 'pending',
                },
            });

            // Create payment
            await this.prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    amount: 2000,
                    method: 'banking',
                    status: 'pending',
                },
            });

            return { bookingId: booking.id };
        } catch (error: any) {
            throw new BadRequestException(error?.message ?? 'Create booking failed');
        }
    }

    /**
     * Get booking by ID
     */
    async getBookingById(bookingId: string): Promise<BookingResponse> {
        if (!bookingId) {
            throw new BadRequestException('MISSING_ID');
        }

        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: {
                    select: {
                        amount: true,
                        status: true,
                    },
                },
            },
        });

        if (!booking) {
            throw new NotFoundException('NOT_FOUND');
        }

        const amount = booking.payment?.amount ?? 2000;

        // Check if expired
        if (
            booking.status === 'pending' &&
            booking.createdAt &&
            this.isExpired(booking.createdAt, 5)
        ) {
            await this.prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'expired' },
            });

            return {
                id: booking.id,
                status: 'expired',
                amount,
                created_at: booking.createdAt.toISOString(),
            };
        }

        return {
            id: booking.id,
            status: booking.status ?? 'pending',
            amount,
            created_at: booking.createdAt?.toISOString(),
        };
    }
}
