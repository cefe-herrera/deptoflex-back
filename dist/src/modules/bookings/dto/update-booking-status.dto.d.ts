import { BookingStatus } from '@prisma/client';
export declare class UpdateBookingStatusDto {
    status: BookingStatus;
    reason?: string;
}
