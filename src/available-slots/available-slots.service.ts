import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GetAvailableSlotsDto, SlotStat } from './dto';

@Injectable()
export class AvailableSlotsService {
    constructor(private supabaseService: SupabaseService) { }

    /**
     * Convert time string (HH:MM) to minutes
     */
    private timeToMinutes(t: string): number {
        const [hh, mm] = t.split(':');
        return Number(hh) * 60 + Number(mm);
    }

    /**
     * Convert minutes to HH:MM format
     */
    private minutesToHHMM(mins: number): string {
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    async getAvailableSlots(params: GetAvailableSlotsDto): Promise<SlotStat[]> {
        const { clinic_id, service_id, date } = params;

        if (!clinic_id || !service_id || !date) {
            throw new BadRequestException('Missing query params');
        }

        // Get service duration
        const { data: service, error: serviceErr } = await this.supabaseService
            .getAdminClient()
            .from('services')
            .select('duration_minutes')
            .eq('id', service_id)
            .single();

        if (serviceErr || !service) {
            throw new NotFoundException('Service not found');
        }
        const duration = service.duration_minutes ?? 30;

        // Get doctors for this clinic and service
        const { data: doctors, error: docErr } = await this.supabaseService
            .getAdminClient()
            .from('doctors')
            .select('id, doctor_services!inner(service_id)')
            .eq('clinic_id', clinic_id)
            .eq('is_available', true)
            .eq('doctor_services.service_id', service_id);

        if (docErr) {
            throw new Error(docErr.message);
        }
        if (!doctors?.length) return [];

        const doctorIds = doctors.map((d) => d.id);

        // Get schedules for these doctors on this date
        const { data: schedules, error: schErr } = await this.supabaseService
            .getAdminClient()
            .from('doctor_schedules')
            .select('doctor_id, start_time, end_time, max_patients')
            .eq('date', date)
            .eq('is_available', true)
            .in('doctor_id', doctorIds);

        if (schErr) {
            throw new Error(schErr.message);
        }
        if (!schedules?.length) return [];

        // Get existing bookings for this date
        const { data: bookings, error: bookErr } = await this.supabaseService
            .getAdminClient()
            .from('bookings')
            .select('booking_time')
            .eq('clinic_id', clinic_id)
            .eq('service_id', service_id)
            .in('status', ['pending', 'paid'])
            .gte('booking_time', `${date} 00:00:00`)
            .lte('booking_time', `${date} 23:59:59`);

        if (bookErr) {
            throw new Error(bookErr.message);
        }

        // Count bookings by time slot
        const bookedByTime = new Map<string, number>();
        for (const b of bookings ?? []) {
            const hhmm = String(b.booking_time).slice(11, 16);
            bookedByTime.set(hhmm, (bookedByTime.get(hhmm) ?? 0) + 1);
        }

        // Calculate capacity for each time slot
        const capacityByTime = new Map<string, number>();

        for (const s of schedules) {
            const start = this.timeToMinutes(String(s.start_time));
            const end = this.timeToMinutes(String(s.end_time));
            const capPerSlot = s.max_patients ?? 0;

            for (let t = start; t + duration <= end; t += duration) {
                const hhmm = this.minutesToHHMM(t);
                capacityByTime.set(hhmm, (capacityByTime.get(hhmm) ?? 0) + capPerSlot);
            }
        }

        // Build result with available slots
        const result: SlotStat[] = Array.from(capacityByTime.entries())
            .map(([time, capacity]) => {
                const booked = bookedByTime.get(time) ?? 0;
                const available = Math.max(capacity - booked, 0);
                return { time, capacity, booked, available };
            })
            .filter((s) => s.available > 0)
            .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));

        return result;
    }
}
