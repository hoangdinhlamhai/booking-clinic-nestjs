import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Headers,
    HttpException,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto';

@Controller('api/bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Post()
    async createBooking(
        @Body() createBookingDto: CreateBookingDto,
        @Headers('authorization') authHeader: string,
    ) {
        try {
            // Extract user from token
            const { userId, email } = this.bookingsService.extractUserFromToken(authHeader);

            if (!email) {
                throw new UnauthorizedException('Unauthorized');
            }

            return await this.bookingsService.createBooking(createBookingDto, userId);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Create booking error:', error);
            throw new HttpException(
                { error: error.message || 'Create booking failed' },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get(':id')
    async getBookingById(@Param('id') id: string) {
        try {
            return await this.bookingsService.getBookingById(id);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Get booking error:', error);
            throw new HttpException(
                { message: 'Server error' },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
