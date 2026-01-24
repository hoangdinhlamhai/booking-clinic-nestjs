import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { ClinicsModule } from './clinics';
import { ServicesModule } from './services';
import { AuthModule } from './auth';
import { SepayModule } from './sepay';
import { AvailableSlotsModule } from './available-slots';
import { BookingsModule } from './bookings';

@Module({
  imports: [
    // Cấu hình đọc file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Kết nối Database với Prisma ORM
    PrismaModule,
    // Feature Modules
    AuthModule,
    ClinicsModule,
    ServicesModule,
    SepayModule,
    AvailableSlotsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

