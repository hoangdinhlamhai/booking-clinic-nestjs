import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ServicesService } from './services.service';

@Controller('api/services')
export class ServicesController {
    constructor(private readonly servicesService: ServicesService) { }

    @Get()
    async findAll() {
        try {
            return await this.servicesService.findAll();
        } catch (error) {
            throw new HttpException(
                { error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
