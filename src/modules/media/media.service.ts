import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { MediaStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MediaService {
  private readonly bucket: string;

  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
    private config: ConfigService,
  ) {
    this.bucket = this.config.get<string>('r2.bucket')!;
  }

  async presignForProperty(propertyId: string, dto: PresignUploadDto, userId: string) {
    await this.assertPropertyExists(propertyId);
    return this.createPresign('properties', propertyId, dto, userId);
  }

  async presignForUnit(unitId: string, dto: PresignUploadDto, userId: string) {
    await this.assertUnitExists(unitId);
    return this.createPresign('units', unitId, dto, userId);
  }

  private async createPresign(
    entity: 'properties' | 'units',
    entityId: string,
    dto: PresignUploadDto,
    userId: string,
  ) {
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
        status: MediaStatus.PENDING,
      },
    });

    return { uploadUrl, objectKey, mediaFileId: mediaFile.id, expiresIn: 300 };
  }

  async confirmForProperty(propertyId: string, dto: ConfirmUploadDto) {
    const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.propertyImage.updateMany({ where: { propertyId }, data: { isPrimary: false } });
      }
      const image = await tx.propertyImage.create({
        data: { propertyId, mediaFileId: mediaFile.id, isPrimary: dto.isPrimary ?? false, caption: dto.caption, sortOrder: dto.sortOrder ?? 0 },
      });
      await tx.mediaFile.update({ where: { id: mediaFile.id }, data: { status: MediaStatus.CONFIRMED, confirmedAt: new Date() } });
      return image;
    });
  }

  async confirmForUnit(unitId: string, dto: ConfirmUploadDto) {
    const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.unitImage.updateMany({ where: { unitId }, data: { isPrimary: false } });
      }
      const image = await tx.unitImage.create({
        data: { unitId, mediaFileId: mediaFile.id, isPrimary: dto.isPrimary ?? false, caption: dto.caption, sortOrder: dto.sortOrder ?? 0 },
      });
      await tx.mediaFile.update({ where: { id: mediaFile.id }, data: { status: MediaStatus.CONFIRMED, confirmedAt: new Date() } });
      return image;
    });
  }

  async deletePropertyImage(propertyId: string, imageId: string) {
    const image = await this.prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
      include: { mediaFile: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.$transaction([
      this.prisma.propertyImage.delete({ where: { id: imageId } }),
      this.prisma.mediaFile.update({ where: { id: image.mediaFileId }, data: { status: MediaStatus.DELETED, deletedAt: new Date() } }),
    ]);

    this.r2.deleteObject(image.mediaFile.objectKey).catch(console.error);
  }

  async deleteUnitImage(unitId: string, imageId: string) {
    const image = await this.prisma.unitImage.findFirst({
      where: { id: imageId, unitId },
      include: { mediaFile: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.$transaction([
      this.prisma.unitImage.delete({ where: { id: imageId } }),
      this.prisma.mediaFile.update({ where: { id: image.mediaFileId }, data: { status: MediaStatus.DELETED, deletedAt: new Date() } }),
    ]);

    this.r2.deleteObject(image.mediaFile.objectKey).catch(console.error);
  }

  private async resolveMediaFile(mediaFileId: string) {
    const file = await this.prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
    if (!file || file.status !== MediaStatus.PENDING) {
      throw new NotFoundException('MediaFile not found or already processed');
    }
    const exists = await this.r2.objectExists(file.objectKey);
    if (!exists) throw new BadRequestException('File not yet uploaded to storage');
    return file;
  }

  private async assertPropertyExists(id: string) {
    const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('Property not found');
  }

  private async assertUnitExists(id: string) {
    const u = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException('Unit not found');
  }
}
