import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Service } from '../supabase/types';

@Injectable()
export class ServicesService {
    constructor(private supabaseService: SupabaseService) { }

    async findAll(): Promise<Pick<Service, 'id' | 'name'>[]> {
        const { data, error } = await this.supabaseService
            .getAdminClient()
            .from('services')
            .select('id, name')
            .order('name', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return data ?? [];
    }
}
