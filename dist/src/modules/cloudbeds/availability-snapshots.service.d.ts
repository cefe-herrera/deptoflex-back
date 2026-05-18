import { PrismaService } from '../prisma/prisma.service';
import type { AvailabilityResult } from './providers/booking-provider.interface';
export declare class AvailabilitySnapshotsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    record(params: {
        propertyId: string;
        checkin: string;
        checkout: string;
        currencyCode: string;
        lang: string;
        result: AvailabilityResult;
    }): Promise<void>;
}
