export declare class CreateBookingDto {
    leadId?: string;
    unitId: string;
    professionalProfileId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children?: number;
    baseAmount: number;
    totalAmount: number;
    currency?: string;
    notes?: string;
}
