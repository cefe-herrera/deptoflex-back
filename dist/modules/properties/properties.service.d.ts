import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertiesDto } from './dto/query-properties.dto';
export declare class PropertiesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreatePropertyDto): Promise<{
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
    }>;
    findAll(query: QueryPropertiesDto): Promise<{
        items: ({
            _count: {
                units: number;
            };
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
            propertyImages: ({
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
                propertyId: string;
                mediaFileId: string;
                caption: string | null;
                sortOrder: number;
            })[];
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
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        _count: {
            units: number;
        };
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
        propertyImages: ({
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
            propertyId: string;
            mediaFileId: string;
            caption: string | null;
            sortOrder: number;
        })[];
        propertyAmenities: ({
            amenity: {
                id: string;
                createdAt: Date;
                name: string;
                updatedAt: Date;
                category: import(".prisma/client").$Enums.AmenityCategory;
                icon: string | null;
            };
        } & {
            propertyId: string;
            amenityId: string;
        })[];
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
    }>;
    update(id: string, dto: UpdatePropertyDto): Promise<{
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
    }>;
    softDelete(id: string): Promise<void>;
    addAmenity(propertyId: string, amenityId: string): Promise<{
        propertyId: string;
        amenityId: string;
    }>;
    removeAmenity(propertyId: string, amenityId: string): Promise<void>;
}
