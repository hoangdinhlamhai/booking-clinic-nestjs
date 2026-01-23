import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SepayWebhookPayload, GenerateQRParams } from './dto';

@Injectable()
export class SepayService {
    constructor(private supabaseService: SupabaseService) { }

    /**
     * Generate Sepay QR code URL
     */
    generateQR(params: GenerateQRParams): string {
        const { bankCode, accountNo, amount, description } = params;
        return `https://qr.sepay.vn/img?bank=${bankCode}&acc=${accountNo}&amount=${amount}&des=${encodeURIComponent(description)}`;
    }

    /**
     * Handle Sepay webhook
     */
    async handleWebhook(payload: SepayWebhookPayload) {
        console.log('SEPAY WEBHOOK PAYLOAD:', payload);

        // Only process incoming transfers
        if (payload?.transferType !== 'in') {
            return { ok: true };
        }

        const rawContent = payload?.content ?? payload?.description ?? '';


        const match = rawContent.match(/DATLICH[\s._-]?([a-zA-Z0-9-]+)/i);

        if (!match) {
            console.error('NO DATLICH BOOKING ID FOUND IN CONTENT:', rawContent);
            return { ok: true };
        }

        let bookingId = match[1];
        console.log('EXTRACTED BOOKING ID RAW:', bookingId);

        // Reconstruct UUID if it's stripped (32 hex chars)
        if (bookingId.length === 32 && !bookingId.includes('-')) {
            bookingId = `${bookingId.slice(0, 8)}-${bookingId.slice(8, 12)}-${bookingId.slice(12, 16)}-${bookingId.slice(16, 20)}-${bookingId.slice(20)}`;
            console.log('FORMATTED BOOKING ID (UUID):', bookingId);
        }

        const paidAmount = Number(payload?.transferAmount ?? 0);

        // Get booking
        const { data: booking, error: bookingErr } = await this.supabaseService
            .getAdminClient()
            .from('bookings')
            .select('id, status')
            .eq('id', bookingId)
            .single();

        if (bookingErr || !booking) {
            console.error('BOOKING NOT FOUND:', bookingId);
            return { ok: true };
        }

        // Already paid
        if (booking.status === 'paid') {
            return { ok: true, alreadyPaid: true };
        }

        // Get payment
        const { data: payment, error: payErr } = await this.supabaseService
            .getAdminClient()
            .from('payments')
            .select('id, amount, status')
            .eq('booking_id', booking.id)
            .eq('status', 'pending')
            .single();

        if (payErr || !payment) {
            console.error('PAYMENT NOT FOUND:', bookingId);
            return { ok: true };
        }

        // Check amount
        if (paidAmount < Number(payment.amount)) {
            console.error('AMOUNT NOT ENOUGH:', paidAmount, 'EXPECTED:', payment.amount);
            return { ok: true };
        }

        // Update payment status
        await this.supabaseService
            .getAdminClient()
            .from('payments')
            .update({
                status: 'paid',
                method: 'sepay',
                transaction_code: payload?.referenceCode ?? null,
                payment_date: new Date().toISOString(),
            })
            .eq('id', payment.id);

        // Update booking status
        await this.supabaseService
            .getAdminClient()
            .from('bookings')
            .update({ status: 'paid' })
            .eq('id', booking.id);

        console.log('BOOKING PAID:', bookingId);

        return { success: true };
    }
}
