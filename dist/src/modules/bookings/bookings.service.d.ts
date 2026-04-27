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
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
        baseAmount: Decimal;
        totalAmount: Decimal;
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
            professionalProfileId: string | null;
            leadId: string | null;
            totalNights: number;
            baseAmount: Decimal;
            totalAmount: Decimal;
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
            updatedAt: Date;
            userId: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            bio: string | null;
            licenseNumber: string | null;
            defaultCommissionRate: Decimal;
            isVerified: boolean;
            verifiedAt: Date | null;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
            ambassadorRequestedAt: Date | null;
        }) | null;
        unit: {
            property: {
                address: {
                    number: string | null;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    propertyId: string;
                    street: string;
                    apartment: string | null;
                    neighborhood: string | null;
                    city: string;
                    state: string | null;
                    country: string;
                    postalCode: string | null;
                    latitude: Decimal | null;
                    longitude: Decimal | null;
                } | null;
            } & {
                id: string;
                name: string;
                description: string | null;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                type: import(".prisma/client").$Enums.PropertyType;
                status: import(".prisma/client").$Enums.PropertyStatus;
                companyId: string | null;
            };
        } & {
            id: string;
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            status: import(".prisma/client").$Enums.UnitStatus;
            propertyId: string;
            floor: number | null;
            bedrooms: number;
            bathrooms: number;
            maxOccupancy: number;
            sizeM2: Decimal | null;
            rentalModality: import(".prisma/client").$Enums.RentalModality | null;
        };
        commission: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.CommissionStatus;
            currency: string;
            bookingId: string;
            notes: string | null;
            professionalProfileId: string | null;
            baseAmount: Decimal;
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
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
        baseAmount: Decimal;
        totalAmount: Decimal;
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
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
        baseAmount: Decimal;
        totalAmount: Decimal;
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
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
        baseAmount: Decimal;
        totalAmount: Decimal;
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
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
        baseAmount: Decimal;
        totalAmount: Decimal;
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
