"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const r2_service_1 = require("../r2/r2.service");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
let MediaService = class MediaService {
    prisma;
    r2;
    config;
    bucket;
    constructor(prisma, r2, config) {
        this.prisma = prisma;
        this.r2 = r2;
        this.config = config;
        this.bucket = this.config.get('r2.bucket');
    }
    async presignForProperty(propertyId, dto, userId) {
        await this.assertPropertyExists(propertyId);
        return this.createPresign('properties', propertyId, dto, userId);
    }
    async presignForUnit(unitId, dto, userId) {
        await this.assertUnitExists(unitId);
        return this.createPresign('units', unitId, dto, userId);
    }
    async createPresign(entity, entityId, dto, userId) {
        const objectKey = this.r2.buildObjectKey(entity, entityId, dto.filename);
        const uploadUrl = await this.r2.generatePresignedPutUrl(objectKey, dto.contentType);
        const url = this.r2.getPublicUrl(objectKey);
        const mediaFile = await this.prisma.mediaFile.create({
            data: {
                uploadedById: userId,
                bucket: this.bucket,
                objectKey,
                originalName: dto.filename,
                mimeType: dto.contentType,
                sizeBytes: dto.fileSize,
                url,
                status: client_1.MediaStatus.PENDING,
            },
        });
        return { uploadUrl, objectKey, mediaFileId: mediaFile.id, expiresIn: 300 };
    }
    async confirmForProperty(propertyId, dto) {
        const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
        return this.prisma.$transaction(async (tx) => {
            if (dto.isPrimary) {
                await tx.propertyImage.updateMany({ where: { propertyId }, data: { isPrimary: false } });
            }
            const image = await tx.propertyImage.create({
                data: { propertyId, mediaFileId: mediaFile.id, isPrimary: dto.isPrimary ?? false, caption: dto.caption, sortOrder: dto.sortOrder ?? 0 },
            });
            await tx.mediaFile.update({ where: { id: mediaFile.id }, data: { status: client_1.MediaStatus.CONFIRMED, confirmedAt: new Date() } });
            return image;
        });
    }
    async confirmForUnit(unitId, dto) {
        const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
        return this.prisma.$transaction(async (tx) => {
            if (dto.isPrimary) {
                await tx.unitImage.updateMany({ where: { unitId }, data: { isPrimary: false } });
            }
            const image = await tx.unitImage.create({
                data: { unitId, mediaFileId: mediaFile.id, isPrimary: dto.isPrimary ?? false, caption: dto.caption, sortOrder: dto.sortOrder ?? 0 },
            });
            await tx.mediaFile.update({ where: { id: mediaFile.id }, data: { status: client_1.MediaStatus.CONFIRMED, confirmedAt: new Date() } });
            return image;
        });
    }
    async deletePropertyImage(propertyId, imageId) {
        const image = await this.prisma.propertyImage.findFirst({
            where: { id: imageId, propertyId },
            include: { mediaFile: true },
        });
        if (!image)
            throw new common_1.NotFoundException('Image not found');
        await this.prisma.$transaction([
            this.prisma.propertyImage.delete({ where: { id: imageId } }),
            this.prisma.mediaFile.update({ where: { id: image.mediaFileId }, data: { status: client_1.MediaStatus.DELETED, deletedAt: new Date() } }),
        ]);
        this.r2.deleteObject(image.mediaFile.objectKey).catch(console.error);
    }
    async deleteUnitImage(unitId, imageId) {
        const image = await this.prisma.unitImage.findFirst({
            where: { id: imageId, unitId },
            include: { mediaFile: true },
        });
        if (!image)
            throw new common_1.NotFoundException('Image not found');
        await this.prisma.$transaction([
            this.prisma.unitImage.delete({ where: { id: imageId } }),
            this.prisma.mediaFile.update({ where: { id: image.mediaFileId }, data: { status: client_1.MediaStatus.DELETED, deletedAt: new Date() } }),
        ]);
        this.r2.deleteObject(image.mediaFile.objectKey).catch(console.error);
    }
    async resolveMediaFile(mediaFileId) {
        const file = await this.prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
        if (!file || file.status !== client_1.MediaStatus.PENDING) {
            throw new common_1.NotFoundException('MediaFile not found or already processed');
        }
        const exists = await this.r2.objectExists(file.objectKey);
        if (!exists)
            throw new common_1.BadRequestException('File not yet uploaded to storage');
        return file;
    }
    async assertPropertyExists(id) {
        const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null } });
        if (!p)
            throw new common_1.NotFoundException('Property not found');
    }
    async assertUnitExists(id) {
        const u = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
        if (!u)
            throw new common_1.NotFoundException('Unit not found');
    }
};
exports.MediaService = MediaService;
exports.MediaService = MediaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        r2_service_1.R2Service,
        config_1.ConfigService])
], MediaService);
//# sourceMappingURL=media.service.js.map