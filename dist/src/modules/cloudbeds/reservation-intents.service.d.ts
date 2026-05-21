import { PrismaService } from '../prisma/prisma.service';
import { CloudbedsService } from './cloudbeds.service';
import { CreateReservationIntentDto } from './dto/create-reservation-intent.dto';
import { type BookingProvider } from './providers/booking-provider.interface';
export interface ReservationIntentResult {
    reservationIntentId: string;
    redirectUrl: string;
    expiresAt: Date;
    validatedTotalAmount: number | null;
    remaining: number;
}
export declare class ReservationIntentsService {
    private readonly prisma;
    private readonly cloudbeds;
    private readonly provider;
    private readonly logger;
    private readonly intentTtlMs;
    constructor(prisma: PrismaService, cloudbeds: CloudbedsService, provider: BookingProvider);
    create(dto: CreateReservationIntentDto, context: {
        userId?: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<ReservationIntentResult>;
    markRedirected(id: string): Promise<void>;
    findOne(id: string): Promise<{
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
        rateId: string | null;
        roomTypeId: string;
        redirectUrl: string;
        redirectedAt: Date | null;
    }>;
    expirePendingIntents(): Promise<void>;
}
