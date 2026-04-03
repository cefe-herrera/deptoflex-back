import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { SetAvailabilityDto } from './dto/set-availability.dto';
import { SetPricingRulesDto } from './dto/set-pricing-rules.dto';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UnitStatus } from '@prisma/client';
export declare class UnitsController {
    private unitsService;
    private mediaService;
    constructor(unitsService: UnitsService, mediaService: MediaService);
    create(dto: CreateUnitDto): Promise<{
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
    }>;
    findAll(page?: number, limit?: number, propertyId?: string, status?: UnitStatus): Promise<{
        items: ({
            property: {
                id: string;
                name: string;
            };
            unitImages: ({
                mediaFile: {
                    url: string;
                    bucket: string;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
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
            createdAt: Date;
            name: string;
            updatedAt: Date;
            deletedAt: Date | null;
            type: import(".prisma/client").$Enums.PropertyType;
            status: import(".prisma/client").$Enums.PropertyStatus;
            description: string | null;
            companyId: string | null;
        };
        unitImages: ({
            mediaFile: {
                url: string;
                bucket: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
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
                createdAt: Date;
                name: string;
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
            createdAt: Date;
            name: string | null;
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
    }>;
    update(id: string, dto: UpdateUnitDto): Promise<{
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
    }>;
    remove(id: string): Promise<void>;
    getAvailability(id: string, from?: string, to?: string): Promise<{
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
    setAvailability(id: string, dto: SetAvailabilityDto): Promise<{
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
    getRates(id: string): Promise<{
        id: string;
        createdAt: Date;
        name: string | null;
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
    setRates(id: string, dto: SetPricingRulesDto): Promise<import(".prisma/client").Prisma.BatchPayload>;
    addAmenity(id: string, amenityId: string): Promise<{
        amenityId: string;
        unitId: string;
    }>;
    removeAmenity(id: string, amenityId: string): Promise<void>;
    presignImage(id: string, dto: PresignUploadDto, user: CurrentUserPayload): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    confirmImage(id: string, dto: ConfirmUploadDto): Promise<{
        id: string;
        createdAt: Date;
        isPrimary: boolean;
        mediaFileId: string;
        caption: string | null;
        sortOrder: number;
        unitId: string;
    }>;
    deleteImage(id: string, imageId: string): Promise<void>;
}
