export class GetAvailableSlotsDto {
    clinic_id: string;
    service_id: string;
    date: string;
}

export interface SlotStat {
    time: string;
    capacity: number;
    booked: number;
    available: number;
}
