export class SepayWebhookPayload {
    transferType: 'in' | 'out';
    content?: string;
    description?: string;
    transferAmount?: number;
    referenceCode?: string;
}

export interface GenerateQRParams {
    bankCode: string;
    accountNo: string;
    amount: number;
    description: string;
}
