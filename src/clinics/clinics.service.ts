import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Clinic } from '../supabase/types';

@Injectable()
export class ClinicsService {
    constructor(private supabaseService: SupabaseService) { }

    async findAll(): Promise<Pick<Clinic, 'id' | 'name'>[]> {
        const { data, error } = await this.supabaseService
            .getAdminClient()
            .from('clinics')
            .select('id, name')
            .order('name', { ascending: true });

        if (error) {
            throw new Error(error.message);
        }

        return data ?? [];
    }
}

