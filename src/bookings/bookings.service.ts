import {
    Injectable,
    BadRequestException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBookingDto, BookingResponse } from './dto';

@Injectable()
export class BookingsService {
    constructor(
        private supabaseService: SupabaseService,
        private jwtService: JwtService,
    ) { }

    /**
     * Check if booking is expired (default 5 minutes)
     */
    private isExpired(createdAt: string, minutes = 5): boolean {
        const created = new Date(createdAt + 'Z').getTime();
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
        // Create booking
        const { data: booking, error: bookingError } = await this.supabaseService
            .getAdminClient()
            .from('bookings')
            .insert({
                user_id: userId ?? null,
                clinic_id: createBookingDto.clinic,
                service_id: createBookingDto.service,
                patient_name: createBookingDto.name,
                patient_phone: createBookingDto.phone,
                gender: createBookingDto.gender ?? null,
                age: createBookingDto.age ?? null,
                symptoms: createBookingDto.symptoms ?? null,
                booking_time: createBookingDto.booking_time,
                status: 'pending',
            })
            .select('id')
            .single();

        if (bookingError || !booking) {
            throw new BadRequestException(bookingError?.message ?? 'Create booking failed');
        }

        // Create payment
        const { error: paymentError } = await this.supabaseService
            .getAdminClient()
            .from('payments')
            .insert({
                booking_id: booking.id,
                amount: 2000,
                method: 'banking',
                status: 'pending',
            });

        if (paymentError) {
            throw new BadRequestException(paymentError.message);
        }

        return { bookingId: booking.id };
    }

    /**
     * Get booking by ID
     */
    async getBookingById(bookingId: string): Promise<BookingResponse> {
        if (!bookingId) {
            throw new BadRequestException('MISSING_ID');
        }

        const { data: booking, error } = await this.supabaseService
            .getAdminClient()
            .from('bookings')
            .select(
                `
        id,
        status,
        created_at,
        payments (
          amount,
          status
        )
      `,
            )
            .eq('id', bookingId)
            .single();

        if (error || !booking) {
            throw new NotFoundException('NOT_FOUND');
        }

        const amount = 2000;

        // Check if expired
        if (
            booking.status === 'pending' &&
            booking.created_at &&
            this.isExpired(booking.created_at, 5)
        ) {
            await this.supabaseService
                .getAdminClient()
                .from('bookings')
                .update({ status: 'expired' })
                .eq('id', bookingId);

            return {
                id: booking.id,
                status: 'expired',
                amount,
                created_at: booking.created_at,
            };
        }

        return {
            id: booking.id,
            status: booking.status,
            amount,
            created_at: booking.created_at,
        };
    }
}
