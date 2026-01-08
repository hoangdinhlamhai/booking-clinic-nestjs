import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase';
import { ClinicsModule } from './clinics';
import { ServicesModule } from './services';
import { AuthModule } from './auth';

@Module({
  imports: [
    // Cấu hình đọc file .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Kết nối Supabase
    SupabaseModule,
    // Feature Modules
    AuthModule,
    ClinicsModule,
    ServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
