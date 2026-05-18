import { PrismaService } from '../prisma/prisma.service';
import { AvailabilitySnapshotsService } from './availability-snapshots.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { type AvailableRoom, type BookingProvider } from './providers/booking-provider.interface';
export interface EnrichedRoom extends AvailableRoom {
    localUnits: Array<{
        id: string;
        name: string;
        description: string | null;
        bedrooms: number;
        bathrooms: number;
        maxOccupancy: number;
    }>;
}
export interface EnrichedAvailabilityResult {
    propertyId: string;
    propertyName: string;
    propertyExternalId: string;
    checkin: string;
    checkout: string;
    currencyCode: string;
    lang: string;
    totalAvailable: number;
    rooms: EnrichedRoom[];
    meta?: Record<string, unknown>;
}
export declare class CloudbedsService {
    private readonly prisma;
    private readonly snapshots;
    private readonly provider;
    private readonly logger;
    constructor(prisma: PrismaService, snapshots: AvailabilitySnapshotsService, provider: BookingProvider);
    searchAvailability(dto: SearchAvailabilityDto): Promise<EnrichedAvailabilityResult>;
    private enrichWithLocalUnits;
    private assertDatesValid;
}
