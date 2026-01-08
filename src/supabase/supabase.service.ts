import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
    private supabase: SupabaseClient;
    private supabaseAdmin: SupabaseClient;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
        const supabaseServiceRoleKey = this.configService.get<string>(
            'SUPABASE_SERVICE_ROLE_KEY',
        );

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase URL and Anon Key must be provided');
        }

        // Client thông thường (sử dụng anon key)
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Admin client (sử dụng service role key - bypass RLS)
        if (supabaseServiceRoleKey) {
            this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
        }
    }

    /**
     * Get Supabase client (với anon key)
     * Sử dụng cho các operations bình thường, tuân theo RLS
     */
    getClient(): SupabaseClient {
        return this.supabase;
    }

    /**
     * Get Supabase admin client (với service role key)
     * Sử dụng cho admin operations, bypass RLS
     */
    getAdminClient(): SupabaseClient {
        if (!this.supabaseAdmin) {
            throw new Error('Supabase Service Role Key is not configured');
        }
        return this.supabaseAdmin;
    }
}
