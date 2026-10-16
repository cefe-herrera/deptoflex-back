import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { UnitStatus } from '@prisma/client';

/**
 * Filtros de búsqueda compartidos por los listados del catálogo (flex, propiedades, unidades).
 * La búsqueda por IA traduce el texto del usuario a estos mismos parámetros.
 */
export class CatalogSearchFiltersDto {
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minBedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minBathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) minGuests?: number;

  /** Acepta `amenityIds=a,b` o `amenityIds=a&amenityIds=b`. Exige todas. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  amenityIds?: string[];
}

const insensitive = (value: string) => ({
  contains: value,
  mode: 'insensitive' as const,
});

/** Filtro sobre PropertyAddress / PropertyFlexAddress. */
export function addressSearchWhere(
  f: Pick<CatalogSearchFiltersDto, 'city' | 'neighborhood'>,
) {
  const city = f.city?.trim();
  const neighborhood = f.neighborhood?.trim();
  if (!city && !neighborhood) return undefined;
  return {
    ...(city && { city: insensitive(city) }),
    ...(neighborhood && {
      OR: [
        { neighborhood: insensitive(neighborhood) },
        { street: insensitive(neighborhood) },
      ],
    }),
  };
}

/** bedrooms / bathrooms / maxOccupancy como mínimos (PropertyFlex y Unit). */
export function capacitySearchWhere(f: CatalogSearchFiltersDto) {
  return {
    ...(f.minBedrooms != null && { bedrooms: { gte: f.minBedrooms } }),
    ...(f.minBathrooms != null && { bathrooms: { gte: f.minBathrooms } }),
    ...(f.minGuests != null && { maxOccupancy: { gte: f.minGuests } }),
  };
}

function hasCapacityFilter(f: CatalogSearchFiltersDto): boolean {
  return f.minBedrooms != null || f.minBathrooms != null || f.minGuests != null;
}

export function flexSearchWhere(f: CatalogSearchFiltersDto) {
  const address = addressSearchWhere(f);
  return {
    ...capacitySearchWhere(f),
    ...(address && { address }),
    ...(f.amenityIds?.length && {
      AND: f.amenityIds.map((amenityId) => ({
        amenities: { some: { amenityId } },
      })),
    }),
  };
}

/** Propiedad temporal: coincide si alguna de sus unidades activas cumple capacidad; comodidades en la propiedad o en alguna unidad. */
export function propertySearchWhere(f: CatalogSearchFiltersDto) {
  const address = addressSearchWhere(f);
  const activeUnit = { deletedAt: null, status: UnitStatus.ACTIVE };
  return {
    ...(address && { address }),
    ...((hasCapacityFilter(f) || f.amenityIds?.length) && {
      AND: [
        ...(hasCapacityFilter(f)
          ? [{ units: { some: { ...activeUnit, ...capacitySearchWhere(f) } } }]
          : []),
        ...(f.amenityIds ?? []).map((amenityId) => ({
          OR: [
            { propertyAmenities: { some: { amenityId } } },
            {
              units: {
                some: { ...activeUnit, unitAmenities: { some: { amenityId } } },
              },
            },
          ],
        })),
      ],
    }),
  };
}

/** Unidad: comodidades propias o heredadas de la propiedad. */
export function unitSearchWhere(f: CatalogSearchFiltersDto) {
  const address = addressSearchWhere(f);
  return {
    ...capacitySearchWhere(f),
    ...(address && { property: { address } }),
    ...(f.amenityIds?.length && {
      AND: f.amenityIds.map((amenityId) => ({
        OR: [
          { unitAmenities: { some: { amenityId } } },
          { property: { propertyAmenities: { some: { amenityId } } } },
        ],
      })),
    }),
  };
}
