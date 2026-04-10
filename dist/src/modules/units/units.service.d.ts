import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetPricingRulesDto } from './dto/set-pricing-rules.dto';
import { UnitStatus } from '@prisma/client';
export declare class UnitsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateUnitDto): Promise<{
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
    }>;
    findAll(page?: number, limit?: number, propertyId?: string, status?: UnitStatus): Promise<{
        items: ({
            property: {
                id: string;
                name: string;
            };
            unitImages: ({
                mediaFile: {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    url: string;
                    bucket: string;
                    deletedAt: Date | null;
                    status: import(".prisma/client").$Enums.MediaStatus;
                    objectKey: string;
                    originalName: string;
                    mimeType: string;
                    sizeBytes: number;
                    confirmedAt: Date | null;
                    uploadedById: string;
                };
            } & {
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                mediaFileId: string;
                caption: string | null;
                sortOrder: number;
                unitId: string;
            })[];
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
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
            name: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            type: import(".prisma/client").$Enums.PropertyType;
            status: import(".prisma/client").$Enums.PropertyStatus;
            companyId: string | null;
        };
        unitImages: ({
            mediaFile: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                url: string;
                bucket: string;
                deletedAt: Date | null;
                status: import(".prisma/client").$Enums.MediaStatus;
                objectKey: string;
                originalName: string;
                mimeType: string;
                sizeBytes: number;
                confirmedAt: Date | null;
                uploadedById: string;
            };
        } & {
            id: string;
            createdAt: Date;
            isPrimary: boolean;
            mediaFileId: string;
            caption: string | null;
            sortOrder: number;
            unitId: string;
        })[];
        unitAmenities: ({
            amenity: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                category: import(".prisma/client").$Enums.AmenityCategory;
                icon: string | null;
            };
        } & {
            amenityId: string;
            unitId: string;
        })[];
        pricingRules: {
            id: string;
            name: string | null;
            createdAt: Date;
            updatedAt: Date;
            unitId: string;
            startDate: Date | null;
            endDate: Date | null;
            baseRate: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            rateType: import(".prisma/client").$Enums.RateType;
            minNights: number;
            maxNights: number | null;
            isDefault: boolean;
        }[];
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
    }>;
    update(id: string, dto: UpdateUnitDto): Promise<{
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
    }>;
    softDelete(id: string): Promise<void>;
    getAvailability(unitId: string, from?: string, to?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        unitId: string;
        startDate: Date;
        endDate: Date;
        isAvailable: boolean;
        reason: import(".prisma/client").$Enums.AvailabilityReason | null;
        bookingId: string | null;
    }[]>;
    setAvailability(unitId: string, dto: SetAvailabilityDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        unitId: string;
        startDate: Date;
        endDate: Date;
        isAvailable: boolean;
        reason: import(".prisma/client").$Enums.AvailabilityReason | null;
        bookingId: string | null;
    }>;
    getRates(unitId: string): Promise<{
        id: string;
        name: string | null;
        createdAt: Date;
        updatedAt: Date;
        unitId: string;
        startDate: Date | null;
        endDate: Date | null;
        baseRate: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        rateType: import(".prisma/client").$Enums.RateType;
        minNights: number;
        maxNights: number | null;
        isDefault: boolean;
    }[]>;
    setRates(unitId: string, dto: SetPricingRulesDto): Promise<import(".prisma/client").Prisma.BatchPayload>;
    addAmenity(unitId: string, amenityId: string): Promise<{
        amenityId: string;
        unitId: string;
    }>;
    removeAmenity(unitId: string, amenityId: string): Promise<void>;
}
