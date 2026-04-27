import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetPricingRulesDto } from './dto/set-pricing-rules.dto';
import { UnitStatus, RentalModality } from '@prisma/client';
export declare class UnitsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateUnitDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        floor: number | null;
        bedrooms: number;
        bathrooms: number;
        maxOccupancy: number;
        sizeM2: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.UnitStatus;
        rentalModality: import(".prisma/client").$Enums.RentalModality | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        propertyId: string;
    }>;
    findAll(page?: number, limit?: number, propertyId?: string, status?: UnitStatus, rentalModality?: RentalModality): Promise<{
        items: ({
            property: {
                id: string;
                name: string;
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
            };
            unitImages: ({
                mediaFile: {
                    id: string;
                    status: import(".prisma/client").$Enums.MediaStatus;
                    createdAt: Date;
                    updatedAt: Date;
                    deletedAt: Date | null;
                    uploadedById: string;
                    bucket: string;
                    objectKey: string;
                    originalName: string;
                    mimeType: string;
                    sizeBytes: number;
                    url: string;
                    confirmedAt: Date | null;
                };
            } & {
                id: string;
                createdAt: Date;
                isPrimary: boolean;
                unitId: string;
                mediaFileId: string;
                caption: string | null;
                sortOrder: number;
            })[];
        } & {
            id: string;
            name: string;
            description: string | null;
            floor: number | null;
            bedrooms: number;
            bathrooms: number;
            maxOccupancy: number;
            sizeM2: import("@prisma/client/runtime/library").Decimal | null;
            status: import(".prisma/client").$Enums.UnitStatus;
            rentalModality: import(".prisma/client").$Enums.RentalModality | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            propertyId: string;
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
            status: import(".prisma/client").$Enums.PropertyStatus;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
            companyId: string | null;
            type: import(".prisma/client").$Enums.PropertyType;
        };
        unitImages: ({
            mediaFile: {
                id: string;
                status: import(".prisma/client").$Enums.MediaStatus;
                createdAt: Date;
                updatedAt: Date;
                deletedAt: Date | null;
                uploadedById: string;
                bucket: string;
                objectKey: string;
                originalName: string;
                mimeType: string;
                sizeBytes: number;
                url: string;
                confirmedAt: Date | null;
            };
        } & {
            id: string;
            createdAt: Date;
            isPrimary: boolean;
            unitId: string;
            mediaFileId: string;
            caption: string | null;
            sortOrder: number;
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
            unitId: string;
            amenityId: string;
        })[];
        pricingRules: {
            id: string;
            name: string | null;
            createdAt: Date;
            updatedAt: Date;
            unitId: string;
            isDefault: boolean;
            startDate: Date | null;
            endDate: Date | null;
            baseRate: import("@prisma/client/runtime/library").Decimal;
            currency: string;
            rateType: import(".prisma/client").$Enums.RateType;
            minNights: number;
            maxNights: number | null;
        }[];
    } & {
        id: string;
        name: string;
        description: string | null;
        floor: number | null;
        bedrooms: number;
        bathrooms: number;
        maxOccupancy: number;
        sizeM2: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.UnitStatus;
        rentalModality: import(".prisma/client").$Enums.RentalModality | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        propertyId: string;
    }>;
    update(id: string, dto: UpdateUnitDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        floor: number | null;
        bedrooms: number;
        bathrooms: number;
        maxOccupancy: number;
        sizeM2: import("@prisma/client/runtime/library").Decimal | null;
        status: import(".prisma/client").$Enums.UnitStatus;
        rentalModality: import(".prisma/client").$Enums.RentalModality | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        propertyId: string;
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
        isDefault: boolean;
        startDate: Date | null;
        endDate: Date | null;
        baseRate: import("@prisma/client/runtime/library").Decimal;
        currency: string;
        rateType: import(".prisma/client").$Enums.RateType;
        minNights: number;
        maxNights: number | null;
    }[]>;
    setRates(unitId: string, dto: SetPricingRulesDto): Promise<import(".prisma/client").Prisma.BatchPayload>;
    addAmenity(unitId: string, amenityId: string): Promise<{
        unitId: string;
        amenityId: string;
    }>;
    removeAmenity(unitId: string, amenityId: string): Promise<void>;
}
