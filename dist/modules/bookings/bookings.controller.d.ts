import { BookingsService } from './bookings.service';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
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
            defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
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
                    latitude: import("@prisma/client/runtime/library").Decimal | null;
                    longitude: import("@prisma/client/runtime/library").Decimal | null;
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
            sizeM2: import("@prisma/client/runtime/library").Decimal | null;
        };
        commission: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.CommissionStatus;
            currency: string;
            bookingId: string;
            notes: string | null;
            baseAmount: import("@prisma/client/runtime/library").Decimal;
            professionalProfileId: string | null;
            rate: import("@prisma/client/runtime/library").Decimal;
            commissionAmount: import("@prisma/client/runtime/library").Decimal;
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
        baseAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        professionalProfileId: string | null;
        leadId: string | null;
        totalNights: number;
    }>;
}
