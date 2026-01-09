import { Module } from '@nestjs/common';
import { SepayController } from './sepay.controller';
import { SepayService } from './sepay.service';

@Module({
    controllers: [SepayController],
    providers: [SepayService],
    exports: [SepayService],
})
export class SepayModule { }
