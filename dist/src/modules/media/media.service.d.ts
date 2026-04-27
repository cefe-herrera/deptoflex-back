import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { ConfigService } from '@nestjs/config';
export declare class MediaService {
    private prisma;
    private r2;
    private config;
    private readonly bucket;
    constructor(prisma: PrismaService, r2: R2Service, config: ConfigService);
    presignForProperty(propertyId: string, dto: PresignUploadDto, userId: string): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    presignForUnit(unitId: string, dto: PresignUploadDto, userId: string): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    private createPresign;
    confirmForProperty(propertyId: string, dto: ConfirmUploadDto): Promise<{
        id: string;
        createdAt: Date;
        isPrimary: boolean;
        caption: string | null;
        sortOrder: number;
        propertyId: string;
        mediaFileId: string;
    }>;
    confirmForUnit(unitId: string, dto: ConfirmUploadDto): Promise<{
        id: string;
        createdAt: Date;
        isPrimary: boolean;
        caption: string | null;
        sortOrder: number;
        mediaFileId: string;
        unitId: string;
    }>;
    presignForProfessional(profileId: string, dto: PresignUploadDto, userId: string): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    confirmAvatarForProfessional(profileId: string, dto: ConfirmUploadDto): Promise<{
        avatarUrl: string;
    }>;
    deletePropertyImage(propertyId: string, imageId: string): Promise<void>;
    deleteUnitImage(unitId: string, imageId: string): Promise<void>;
    private resolveMediaFile;
    private assertPropertyExists;
    private assertUnitExists;
    private assertProfessionalExists;
}
