import { AvailabilityReason } from '@prisma/client';
export declare class SetAvailabilityDto {
    startDate: string;
    endDate: string;
    isAvailable: boolean;
    reason?: AvailabilityReason;
}
