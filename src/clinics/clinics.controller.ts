import {
    Controller,
    Get,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';

@Controller('api/clinics')
export class ClinicsController {
    constructor(private readonly clinicsService: ClinicsService) { }

    @Get()
    async findAll() {
        try {
            return await this.clinicsService.findAll();
        } catch (error) {
            throw new HttpException(
                { error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
