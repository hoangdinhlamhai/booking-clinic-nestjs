import {
    Controller,
    Get,
    Query,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { AvailableSlotsService } from './available-slots.service';
import { GetAvailableSlotsDto } from './dto';

@Controller('api/available-slots')
export class AvailableSlotsController {
    constructor(private readonly availableSlotsService: AvailableSlotsService) { }

    @Get()
    async getAvailableSlots(@Query() query: GetAvailableSlotsDto) {
        try {
            return await this.availableSlotsService.getAvailableSlots(query);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error(error);
            throw new HttpException({ error: 'Server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
