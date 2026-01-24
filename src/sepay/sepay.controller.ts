import {
    Controller,
    Post,
    Body,
    Req,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { SepayService } from './sepay.service';
import { SepayWebhookPayload } from './dto';

@Controller('api/sepay')
export class SepayController {
    constructor(private readonly sepayService: SepayService) { }

    @Post('webhook')
    async webhook(@Body() payload: SepayWebhookPayload, @Req() req: Request) {
        try {
            console.log('=== WEBHOOK REQUEST DEBUG ===');
            console.log('Content-Type:', req.headers['content-type']);
            console.log('Body (parsed):', payload);
            console.log('Body (raw):', req.body);

            // Use req.body if payload is undefined (fallback)
            const actualPayload = payload ?? req.body;

            return await this.sepayService.handleWebhook(actualPayload);
        } catch (error) {
            console.error('SEPAY WEBHOOK ERROR:', error);
            throw new HttpException({ error: 'WEBHOOK_ERROR' }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
