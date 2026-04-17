import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertToBookingDto } from './dto/convert-to-booking.dto';
import { AddNoteDto } from './dto/add-note.dto';
export declare class LeadsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLeadDto, professionalProfileId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
        professionalProfileId: string | null;
        unitId: string | null;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        adults: number;
        children: number;
        notes: string | null;
        source: string | null;
    }>;
    findAll(page?: number, limit?: number, userId?: string, roles?: string[]): Promise<{
        items: ({
            unit: {
                id: string;
                name: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            status: import(".prisma/client").$Enums.LeadStatus;
            professionalProfileId: string | null;
            unitId: string | null;
            clientName: string;
            clientEmail: string | null;
            clientPhone: string | null;
            checkInDate: Date | null;
            checkOutDate: Date | null;
            adults: number;
            children: number;
            notes: string | null;
            source: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        professionalProfile: {
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
            defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
            isVerified: boolean;
            verifiedAt: Date | null;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
            ambassadorRequestedAt: Date | null;
        } | null;
        unit: ({
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
                    latitude: import("@prisma/client/runtime/library").Decimal | null;
                    longitude: import("@prisma/client/runtime/library").Decimal | null;
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
            sizeM2: import("@prisma/client/runtime/library").Decimal | null;
        }) | null;
        booking: {
            id: string;
            status: import(".prisma/client").$Enums.BookingStatus;
        } | null;
        leadRequests: {
            id: string;
            createdAt: Date;
            message: string;
            leadId: string;
            createdById: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
        professionalProfileId: string | null;
        unitId: string | null;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        adults: number;
        children: number;
        notes: string | null;
        source: string | null;
    }>;
    update(id: string, dto: UpdateLeadDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
        professionalProfileId: string | null;
        unitId: string | null;
        clientName: string;
        clientEmail: string | null;
        clientPhone: string | null;
        checkInDate: Date | null;
        checkOutDate: Date | null;
        adults: number;
        children: number;
        notes: string | null;
        source: string | null;
    }>;
    addNote(leadId: string, dto: AddNoteDto, createdById: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        leadId: string;
        createdById: string;
    }>;
    convertToBooking(leadId: string, dto: ConvertToBookingDto, changedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.BookingStatus;
        professionalProfileId: string | null;
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
        leadId: string | null;
        totalNights: number;
    }>;
    softDelete(id: string): Promise<void>;
}
