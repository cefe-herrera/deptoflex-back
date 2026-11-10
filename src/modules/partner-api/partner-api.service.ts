import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudbedsService } from '../cloudbeds/cloudbeds.service';
import type { ExternalRequestLogContext } from '../cloudbeds/external-request.types';
import type { PartnerAvailabilityQueryDto } from './dto/partner-availability-query.dto';
import type { ApiUsageMeta } from './partner-api.types';

const PUBLISHED_PROPERTY = {
  status: 'ACTIVE',
  deletedAt: null,
  cloudbedsWidgetPropertyId: { not: null },
} as const;

/**
 * Contrato público y estable de la Partner API. Deliberadamente no expone
 * IDs de Cloudbeds, comparación con OTAs ni respuestas crudas: si cambia la
 * integración interna, esta forma tiene que seguir igual.
 */
@Injectable()
export class PartnerApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudbeds: CloudbedsService,
  ) {}

  async listProperties() {
    const properties = await this.prisma.property.findMany({
      where: PUBLISHED_PROPERTY,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        defaultCurrency: true,
        address: {
          select: {
            neighborhood: true,
            city: true,
            state: true,
            country: true,
            latitude: true,
            longitude: true,
          },
        },
        propertyImages: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 5,
          select: { mediaFile: { select: { url: true } } },
        },
      },
    });

    return properties.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      type: p.type,
      currency: p.defaultCurrency,
      location: p.address
        ? {
            neighborhood: p.address.neighborhood,
            city: p.address.city,
            state: p.address.state,
            country: p.address.country,
            latitude:
              p.address.latitude != null ? Number(p.address.latitude) : null,
            longitude:
              p.address.longitude != null ? Number(p.address.longitude) : null,
          }
        : null,
      images: p.propertyImages.map((i) => i.mediaFile.url),
    }));
  }

  async availability(
    dto: PartnerAvailabilityQueryDto,
    logContext: ExternalRequestLogContext,
    usage: ApiUsageMeta,
  ) {
    usage.propertyId = dto.propertyId;
    usage.checkin = dto.checkin;
    usage.checkout = dto.checkout;

    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, ...PUBLISHED_PROPERTY },
      select: { id: true, cloudbedsWidgetPropertyId: true },
    });
    if (!property?.cloudbedsWidgetPropertyId) {
      throw new NotFoundException('Propiedad no encontrada');
    }

    const result = await this.cloudbeds.searchAvailability(
      {
        propertyId: property.cloudbedsWidgetPropertyId,
        checkin: dto.checkin,
        checkout: dto.checkout,
        adults: dto.adults,
        children: dto.children,
        currencyCode: dto.currency,
        lang: dto.lang,
      },
      logContext,
    );

    const meta = result.meta ?? {};
    usage.cacheHit = meta.fromCache === true || meta.fromSnapshot === true;
    usage.totalAvailable = result.totalAvailable;

    const nights = Math.round(
      (Date.parse(dto.checkout) - Date.parse(dto.checkin)) / 86_400_000,
    );

    return {
      propertyId: result.propertyId,
      propertyName: result.propertyName,
      checkin: result.checkin,
      checkout: result.checkout,
      nights,
      currency: result.currencyCode,
      available: result.totalAvailable > 0,
      totalAvailable: result.totalAvailable,
      /** true si los datos pueden estar desactualizados (Cloudbeds no respondió). */
      stale: meta.stale === true,
      rooms: result.rooms.map((r) => ({
        roomTypeId: r.roomTypeId,
        rateId: r.rateId,
        name: r.name,
        maxGuests: r.maxGuests,
        maxAdults: r.maxAdults,
        maxChildren: r.maxChildren,
        remaining: r.remaining,
        totalAmount: r.totalAmount,
        minNightlyRate: r.minNightlyRate,
        maxNightlyRate: r.maxNightlyRate,
        nightlyRates: r.detailedRates.map((d) => ({
          date: d.date,
          rate: d.rate,
        })),
        photos: r.photos,
        features: r.features,
      })),
    };
  }
}
