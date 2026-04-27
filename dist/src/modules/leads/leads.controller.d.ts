import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertToBookingDto } from './dto/convert-to-booking.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
export declare class LeadsController {
    private leadsService;
    private prisma;
    constructor(leadsService: LeadsService, prisma: PrismaService);
    create(dto: CreateLeadDto, user: CurrentUserPayload): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
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
        professionalProfileId: string | null;
    }>;
    findAll(page: number | undefined, limit: number | undefined, user: CurrentUserPayload): Promise<{
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
            professionalProfileId: string | null;
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
            rentalModality: import(".prisma/client").$Enums.RentalModality | null;
        }) | null;
        booking: {
            id: string;
            status: import(".prisma/client").$Enums.BookingStatus;
        } | null;
        leadRequests: {
            id: string;
            createdAt: Date;
            leadId: string;
            createdById: string;
            message: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
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
        professionalProfileId: string | null;
    }>;
    update(id: string, dto: UpdateLeadDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        status: import(".prisma/client").$Enums.LeadStatus;
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
        professionalProfileId: string | null;
    }>;
    remove(id: string): Promise<void>;
    addNote(id: string, dto: AddNoteDto, user: CurrentUserPayload): Promise<{
        id: string;
        createdAt: Date;
        leadId: string;
        createdById: string;
        message: string;
    }>;
    convertToBooking(id: string, dto: ConvertToBookingDto, user: CurrentUserPayload): Promise<{
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
        baseAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
    }>;
}
