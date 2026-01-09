import { Module } from '@nestjs/common';
import { AvailableSlotsController } from './available-slots.controller';
import { AvailableSlotsService } from './available-slots.service';

@Module({
    controllers: [AvailableSlotsController],
    providers: [AvailableSlotsService],
    exports: [AvailableSlotsService],
})
export class AvailableSlotsModule { }
