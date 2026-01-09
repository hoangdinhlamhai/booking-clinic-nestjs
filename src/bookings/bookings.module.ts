import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secret',
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [BookingsController],
    providers: [BookingsService],
    exports: [BookingsService],
})
export class BookingsModule { }
