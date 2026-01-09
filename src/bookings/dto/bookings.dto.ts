export class CreateBookingDto {
    clinic: string;
    service: string;
    name: string;
    phone: string;
    gender?: string;
    age?: number;
    symptoms?: string;
    booking_time: string;
    amount: number;
}

export interface BookingResponse {
    id: string;
    status: string;
    amount: number;
    created_at: string;
}
