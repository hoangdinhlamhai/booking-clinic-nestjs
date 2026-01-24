import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        if (!email || !password) {
            throw new BadRequestException('Vui lòng nhập email và mật khẩu');
        }

        // 1. Find user
        const user = await this.prisma.user.findFirst({
            where: { email },
        });

        if (!user) {
            throw new UnauthorizedException('Tài khoản không tồn tại');
        }

        if (!user.password) {
            throw new UnauthorizedException('Tài khoản này dùng đăng nhập Google');
        }

        // 2. Check password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new UnauthorizedException('Mật khẩu không đúng');
        }

        // 3. Generate Token
        const payload = {
            userId: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            picture: user.avatarUrl,
        };

        const token = this.jwtService.sign(payload);

        // 4. Return success
        return {
            message: 'Login success',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                image: user.avatarUrl,
            },
        };
    }

    async register(registerDto: RegisterDto) {
        const { name, email, password } = registerDto;

        if (!email || !password || !name) {
            throw new BadRequestException('Vui lòng điền đầy đủ thông tin');
        }

        // Check existing user
        const existingUser = await this.prisma.user.findFirst({
            where: { email },
        });

        if (existingUser) {
            throw new BadRequestException('Email này đã được đăng ký');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        try {
            await this.prisma.user.create({
                data: {
                    email,
                    name,
                    password: hashedPassword,
                    provider: 'credentials',
                    isActive: true,
                    role: 'patient',
                },
            });
        } catch (error) {
            console.error('Registration error:', error);
            throw new BadRequestException('Đã có lỗi xảy ra khi đăng ký');
        }

        return { message: 'Đăng ký thành công' };
    }

    async getMe(token: string) {
        try {
            const decoded = this.jwtService.verify(token);

            if (!decoded) {
                throw new UnauthorizedException('Invalid token');
            }

            return {
                user: {
                    id: decoded.userId,
                    name: decoded.name,
                    email: decoded.email,
                    role: decoded.role,
                    image: decoded.picture,
                },
            };
        } catch {
            throw new UnauthorizedException('Invalid token');
        }
    }
}
