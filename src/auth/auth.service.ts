import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
    constructor(
        private supabaseService: SupabaseService,
        private jwtService: JwtService,
    ) { }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        if (!email || !password) {
            throw new BadRequestException('Vui lòng nhập email và mật khẩu');
        }

        // 1. Find user
        const { data: user, error } = await this.supabaseService
            .getAdminClient()
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
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
            picture: user.avatar_url,
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
                image: user.avatar_url,
            },
        };
    }

    async register(registerDto: RegisterDto) {
        const { name, email, password } = registerDto;

        if (!email || !password || !name) {
            throw new BadRequestException('Vui lòng điền đầy đủ thông tin');
        }

        // Check existing user
        const { data: existingUser } = await this.supabaseService
            .getAdminClient()
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            throw new BadRequestException('Email này đã được đăng ký');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const { error } = await this.supabaseService.getAdminClient().from('users').insert({
            email,
            name,
            password: hashedPassword,
            provider: 'credentials',
            is_active: true,
            role: 'patient',
        });

        if (error) {
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

