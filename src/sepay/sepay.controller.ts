import {
    Controller,
    Post,
    Body,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { SepayService } from './sepay.service';
import { SepayWebhookPayload } from './dto';

@Controller('api/sepay')
export class SepayController {
    constructor(private readonly sepayService: SepayService) { }

    @Post('webhook')
    async webhook(@Body() payload: SepayWebhookPayload) {
        try {
            return await this.sepayService.handleWebhook(payload);
        } catch (error) {
            console.error('SEPAY WEBHOOK ERROR:', error);
            throw new HttpException({ error: 'WEBHOOK_ERROR' }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
