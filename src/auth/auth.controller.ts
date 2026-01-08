import {
    Controller,
    Get,
    Post,
    Body,
    Headers,
    HttpException,
    HttpStatus,
    HttpCode,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto) {
        try {
            return await this.authService.login(loginDto);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Login error:', error);
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() registerDto: RegisterDto) {
        try {
            return await this.authService.register(registerDto);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Registration error:', error);
            throw new HttpException('Đã có lỗi xảy ra', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('me')
    async getMe(@Headers('authorization') authHeader: string) {
        try {
            if (!authHeader?.startsWith('Bearer ')) {
                throw new UnauthorizedException('Unauthorized');
            }

            const token = authHeader.split(' ')[1];
            return await this.authService.getMe(token);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            console.error('Me error:', error);
            throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}

