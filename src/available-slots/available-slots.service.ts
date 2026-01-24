import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { GetAvailableSlotsDto, SlotStat } from './dto';

@Injectable()
export class AvailableSlotsService {
    constructor(private prisma: PrismaService) { }

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

    /**
     * Format Date to time string (HH:MM)
     */
    private dateToTimeString(date: Date): string {
        return date.toTimeString().slice(0, 5);
    }

    async getAvailableSlots(params: GetAvailableSlotsDto): Promise<SlotStat[]> {
        const { clinic_id, service_id, date } = params;

        if (!clinic_id || !service_id || !date) {
            throw new BadRequestException('Missing query params');
        }

        // Get service duration
        const service = await this.prisma.service.findUnique({
            where: { id: service_id },
            select: { durationMinutes: true },
        });

        if (!service) {
            throw new NotFoundException('Service not found');
        }
        const duration = service.durationMinutes ?? 30;

        // Get doctors for this clinic and service
        const doctors = await this.prisma.doctor.findMany({
            where: {
                clinicId: clinic_id,
                isAvailable: true,
                doctorServices: {
                    some: {
                        serviceId: service_id,
                    },
                },
            },
            select: { id: true },
        });

        if (!doctors?.length) return [];

        const doctorIds = doctors.map((d) => d.id);

        // Get schedules for these doctors on this date
        const schedules = await this.prisma.doctorSchedule.findMany({
            where: {
                date: new Date(date),
                isAvailable: true,
                doctorId: { in: doctorIds },
            },
            select: {
                doctorId: true,
                startTime: true,
                endTime: true,
                maxPatients: true,
            },
        });

        if (!schedules?.length) return [];

        // Get existing bookings for this date
        const startOfDay = new Date(`${date}T00:00:00`);
        const endOfDay = new Date(`${date}T23:59:59`);

        const bookings = await this.prisma.booking.findMany({
            where: {
                clinicId: clinic_id,
                serviceId: service_id,
                status: { in: ['pending', 'paid'] },
                bookingTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            select: { bookingTime: true },
        });

        // Count bookings by time slot
        const bookedByTime = new Map<string, number>();
        for (const b of bookings ?? []) {
            const hhmm = b.bookingTime.toTimeString().slice(0, 5);
            bookedByTime.set(hhmm, (bookedByTime.get(hhmm) ?? 0) + 1);
        }

        // Calculate capacity for each time slot
        const capacityByTime = new Map<string, number>();

        for (const s of schedules) {
            const start = this.timeToMinutes(this.dateToTimeString(s.startTime));
            const end = this.timeToMinutes(this.dateToTimeString(s.endTime));
            const capPerSlot = s.maxPatients ?? 0;

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
