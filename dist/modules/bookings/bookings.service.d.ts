import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Decimal } from '@prisma/client/runtime/library';
export declare class BookingsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateBookingDto, changedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        unitId: string;
        currency: string;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date;
        checkOutDate: Date;
        adults: number;
        children: number;
        notes: string | null;
        baseAmount: Decimal;
        totalAmount: Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
    findAll(page?: number, limit?: number, userId?: string, roles?: string[]): Promise<{
        items: ({
            unit: {
                id: string;
                name: string;
            };
            commission: {
                status: import(".prisma/client").$Enums.CommissionStatus;
                commissionAmount: Decimal;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            status: import(".prisma/client").$Enums.BookingStatus;
            unitId: string;
            currency: string;
            clientName: string;
            clientEmail: string | null;
            clientPhone: string | null;
            checkInDate: Date;
            checkOutDate: Date;
            adults: number;
            children: number;
            notes: string | null;
            baseAmount: Decimal;
            totalAmount: Decimal;
            professionalProfileId: string | null;
            leadId: string | null;
            totalNights: number;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        professionalProfile: ({
            user: {
                email: string;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            updatedAt: Date;
            bio: string | null;
            licenseNumber: string | null;
            defaultCommissionRate: Decimal;
            isVerified: boolean;
            verifiedAt: Date | null;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
        }) | null;
        unit: {
            property: {
                address: {
                    number: string | null;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    street: string;
                    apartment: string | null;
                    neighborhood: string | null;
                    city: string;
                    state: string | null;
                    country: string;
                    postalCode: string | null;
                    latitude: Decimal | null;
                    longitude: Decimal | null;
                    propertyId: string;
                } | null;
            } & {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                deletedAt: Date | null;
                type: import(".prisma/client").$Enums.PropertyType;
                status: import(".prisma/client").$Enums.PropertyStatus;
                description: string | null;
                companyId: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            deletedAt: Date | null;
            status: import(".prisma/client").$Enums.UnitStatus;
            description: string | null;
            propertyId: string;
            floor: number | null;
            bedrooms: number;
            bathrooms: number;
            maxOccupancy: number;
            sizeM2: Decimal | null;
        };
        commission: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.CommissionStatus;
            currency: string;
            bookingId: string;
            notes: string | null;
            baseAmount: Decimal;
            professionalProfileId: string | null;
            rate: Decimal;
            commissionAmount: Decimal;
            paidAt: Date | null;
        } | null;
        statusHistory: {
            id: string;
            createdAt: Date;
            reason: string | null;
            bookingId: string;
            fromStatus: import(".prisma/client").$Enums.BookingStatus | null;
            toStatus: import(".prisma/client").$Enums.BookingStatus;
            changedById: string | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        unitId: string;
        currency: string;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date;
        checkOutDate: Date;
        adults: number;
        children: number;
        notes: string | null;
        baseAmount: Decimal;
        totalAmount: Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
    confirm(id: string, reason: string | undefined, changedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        unitId: string;
        currency: string;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date;
        checkOutDate: Date;
        adults: number;
        children: number;
        notes: string | null;
        baseAmount: Decimal;
        totalAmount: Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
    cancel(id: string, reason: string, changedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        unitId: string;
        currency: string;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date;
        checkOutDate: Date;
        adults: number;
        children: number;
        notes: string | null;
        baseAmount: Decimal;
        totalAmount: Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
    complete(id: string, reason: string | undefined, changedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        unitId: string;
        currency: string;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date;
        checkOutDate: Date;
        adults: number;
        children: number;
        notes: string | null;
        baseAmount: Decimal;
        totalAmount: Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
    getStatusHistory(id: string): Promise<({
        changedBy: {
            email: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        reason: string | null;
        bookingId: string;
        fromStatus: import(".prisma/client").$Enums.BookingStatus | null;
        toStatus: import(".prisma/client").$Enums.BookingStatus;
        changedById: string | null;
    })[]>;
    softDelete(id: string): Promise<void>;
}
