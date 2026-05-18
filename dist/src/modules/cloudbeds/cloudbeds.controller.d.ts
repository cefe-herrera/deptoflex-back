import type { Request } from 'express';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CloudbedsService } from './cloudbeds.service';
import { ReservationIntentsService } from './reservation-intents.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { CreateReservationIntentDto } from './dto/create-reservation-intent.dto';
export declare class CloudbedsController {
    private readonly cloudbeds;
    private readonly intents;
    constructor(cloudbeds: CloudbedsService, intents: ReservationIntentsService);
    searchAvailability(dto: SearchAvailabilityDto): Promise<import("./cloudbeds.service").EnrichedAvailabilityResult>;
    createReservationIntent(dto: CreateReservationIntentDto, req: Request, user?: CurrentUserPayload): Promise<import("./reservation-intents.service").ReservationIntentResult>;
    findIntent(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userAgent: string | null;
        ipAddress: string | null;
        expiresAt: Date;
        userId: string | null;
        status: import(".prisma/client").$Enums.ReservationIntentStatus;
        propertyId: string;
        adults: number;
        children: number;
        totalAmount: import("@prisma/client/runtime/library").Decimal | null;
        checkin: Date;
        checkout: Date;
        currencyCode: string;
        roomTypeId: string;
        rateId: string | null;
        redirectUrl: string;
        redirectedAt: Date | null;
    }>;
    markRedirected(id: string): Promise<void>;
}
