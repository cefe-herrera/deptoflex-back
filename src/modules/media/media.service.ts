import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { PresignAmbassadorDocumentDto } from './dto/presign-ambassador-document.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { AmbassadorDocumentType, MediaStatus } from '@prisma/client';
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

  async presignForPropertyFlex(propertyFlexId: string, dto: PresignUploadDto, userId: string) {
    await this.assertPropertyFlexExists(propertyFlexId);
    return this.createPresign('property-flex', propertyFlexId, dto, userId);
  }

  async confirmForPropertyFlex(propertyFlexId: string, dto: ConfirmUploadDto) {
    const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.propertyFlexImage.updateMany({ where: { propertyFlexId }, data: { isPrimary: false } });
      }
      const image = await tx.propertyFlexImage.create({
        data: { propertyFlexId, mediaFileId: mediaFile.id, isPrimary: dto.isPrimary ?? false, caption: dto.caption, sortOrder: dto.sortOrder ?? 0 },
      });
      await tx.mediaFile.update({ where: { id: mediaFile.id }, data: { status: MediaStatus.CONFIRMED, confirmedAt: new Date() } });
      return image;
    });
  }

  async updatePropertyFlexImage(
    propertyFlexId: string,
    imageId: string,
    data: { isPrimary?: boolean; caption?: string; sortOrder?: number },
  ) {
    const image = await this.prisma.propertyFlexImage.findFirst({
      where: { id: imageId, propertyFlexId },
    });
    if (!image) throw new NotFoundException('Image not found');

    return this.prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.propertyFlexImage.updateMany({
          where: { propertyFlexId },
          data: { isPrimary: false },
        });
      }
      return tx.propertyFlexImage.update({
        where: { id: imageId },
        data: {
          ...(data.isPrimary != null && { isPrimary: data.isPrimary }),
          ...(data.caption != null && { caption: data.caption }),
          ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
        },
        include: { mediaFile: true },
      });
    });
  }

  async deletePropertyFlexImage(propertyFlexId: string, imageId: string) {
    const image = await this.prisma.propertyFlexImage.findFirst({
      where: { id: imageId, propertyFlexId },
      include: { mediaFile: true },
    });
    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.$transaction([
      this.prisma.propertyFlexImage.delete({ where: { id: imageId } }),
      this.prisma.mediaFile.update({ where: { id: image.mediaFileId }, data: { status: MediaStatus.DELETED, deletedAt: new Date() } }),
    ]);

    this.r2.deleteObject(image.mediaFile.objectKey).catch(console.error);
  }

  private async createPresign(
    entity: 'properties' | 'units' | 'professionals' | 'property-flex',
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

  async presignForProfessional(profileId: string, dto: PresignUploadDto, userId: string) {
    await this.assertProfessionalExists(profileId);
    return this.createPresign('professionals', profileId, dto, userId);
  }

  async presignAmbassadorDocument(
    profileId: string,
    dto: PresignAmbassadorDocumentDto,
    userId: string,
  ) {
    await this.assertProfessionalExists(profileId);
    return this.createPresign('professionals', profileId, dto, userId);
  }

  async ensureUploaded(mediaFileId: string, uploadedById: string) {
    await this.resolveMediaFileForUser(mediaFileId, uploadedById);
  }

  /**
   * Archivos que el usuario alcanzó a "presignar" (y quizás subir a storage)
   * para su solicitud de embajador, pero que nunca se confirmaron como
   * AmbassadorDocument. Es la pista de un envío que quedó a mitad de camino:
   * el usuario tocó el botón, tal vez la foto llegó al storage, pero algo
   * falló antes de guardarse como documento oficial.
   */
  async findOrphanAmbassadorUploads(profileId: string, uploadedById: string) {
    const pending = await this.prisma.mediaFile.findMany({
      where: {
        uploadedById,
        status: MediaStatus.PENDING,
        objectKey: { startsWith: `professionals/${profileId}/` },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true, sizeBytes: true, createdAt: true, objectKey: true },
    });

    if (pending.length === 0) return [];

    const existsInStorage = await Promise.all(
      pending.map((f) => this.r2.objectExists(f.objectKey)),
    );

    return pending.map((f, i) => ({
      mediaFileId: f.id,
      filename: f.originalName,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt,
      uploadedToStorage: existsInStorage[i],
    }));
  }

  async attachAmbassadorDocuments(
    profileId: string,
    uploadedById: string,
    docs: { mediaFileId: string; documentType: AmbassadorDocumentType }[],
  ) {
    for (const doc of docs) {
      const mediaFile = await this.resolveMediaFileForUser(doc.mediaFileId, uploadedById);
      await this.prisma.$transaction([
        this.prisma.mediaFile.update({
          where: { id: mediaFile.id },
          data: { status: MediaStatus.CONFIRMED, confirmedAt: new Date() },
        }),
        this.prisma.ambassadorDocument.upsert({
          where: {
            professionalProfileId_documentType: {
              professionalProfileId: profileId,
              documentType: doc.documentType,
            },
          },
          create: {
            professionalProfileId: profileId,
            mediaFileId: mediaFile.id,
            documentType: doc.documentType,
          },
          update: { mediaFileId: mediaFile.id },
        }),
      ]);
    }
  }

  async confirmAvatarForProfessional(profileId: string, dto: ConfirmUploadDto) {
    const mediaFile = await this.resolveMediaFile(dto.mediaFileId);
    const url = mediaFile.url;

    await this.prisma.$transaction([
      this.prisma.mediaFile.update({
        where: { id: mediaFile.id },
        data: { status: MediaStatus.CONFIRMED, confirmedAt: new Date() },
      }),
      this.prisma.professionalProfile.update({
        where: { id: profileId },
        data: { avatarUrl: url },
      }),
    ]);

    return { avatarUrl: url };
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
    return this.resolveMediaFileForUser(mediaFileId);
  }

  private async resolveMediaFileForUser(mediaFileId: string, uploadedById?: string) {
    const file = await this.prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
    if (!file || file.status !== MediaStatus.PENDING) {
      throw new NotFoundException('MediaFile not found or already processed');
    }
    if (uploadedById && file.uploadedById !== uploadedById) {
      throw new BadRequestException('MediaFile does not belong to the current user');
    }
    await this.waitForObjectInStorage(file.objectKey);
    return file;
  }

  private async waitForObjectInStorage(objectKey: string, attempts = 8, delayMs = 400) {
    for (let i = 0; i < attempts; i++) {
      if (await this.r2.objectExists(objectKey)) return;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new BadRequestException('File not yet uploaded to storage');
  }

  private async assertPropertyExists(id: string) {
    const p = await this.prisma.property.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('Property not found');
  }

  private async assertUnitExists(id: string) {
    const u = await this.prisma.unit.findFirst({ where: { id, deletedAt: null } });
    if (!u) throw new NotFoundException('Unit not found');
  }

  private async assertPropertyFlexExists(id: string) {
    const p = await this.prisma.propertyFlex.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException('PropertyFlex not found');
  }

  private async assertProfessionalExists(id: string) {
    const p = await this.prisma.professionalProfile.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Professional profile not found');
  }
}
