export interface AdminBooking {
    booking_id: string;
    patient_email?: string | null;
    booking_time: string;
    booking_status: string;
    patient_name: string;
    patient_phone: string;
    clinic_id: string;
    clinic_name: string;
    service_name: string;
    doctor_name: string;
    payment_status?: string;
}

export interface AdminPayment {
    payment_id: string;
    amount: number;
    method: string;
    payment_status: string;
    patient_name: string;
    booking_time: string;
    clinic_name: string;
}
