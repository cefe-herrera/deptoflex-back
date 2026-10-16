import { Injectable } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiAiProvider } from './gemini-ai.provider';
import {
  AiCatalogContext,
  AiSearchFilters,
  AiSearchInterpretation,
  AiSearchResponse,
} from './ai-search.types';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;
const CATALOG_TTL_MS = 10 * 60 * 1000;
const TIMEZONE = 'America/Argentina/Salta';

type CacheEntry = { expires: number; value: AiSearchResponse };

/** Minúsculas y sin tildes, para comparar contra el catálogo. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(
    new Date(),
  );
}

/**
 * Traduce lenguaje natural (texto o voz) a los filtros de los endpoints del catálogo.
 * No busca: el front aplica `filters` a los mismos listados que usa la búsqueda manual.
 */
@Injectable()
export class AiSearchService {
  private readonly cache = new Map<string, CacheEntry>();
  private catalog: {
    expires: number;
    value: Promise<AiCatalogContext>;
  } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiAiProvider,
  ) {}

  async searchByText(query: string): Promise<AiSearchResponse> {
    const trimmed = query.trim();
    const cacheKey = `${todayIso()}:${fold(trimmed).replace(/\s+/g, ' ')}`;
    const cached = this.cacheGet(cacheKey);
    if (cached) return cached;

    const catalog = await this.loadCatalog();
    const interpretation = await this.gemini.interpretQuery(trimmed, catalog);
    const response = {
      query: trimmed,
      ...this.toFilters(interpretation, catalog),
    };

    this.cacheSet(cacheKey, response);
    return response;
  }

  async searchByAudio(
    buffer: Buffer,
    mimeType: string,
  ): Promise<AiSearchResponse> {
    const catalog = await this.loadCatalog();
    const { transcription, interpretation } = await this.gemini.transcribeAudio(
      buffer,
      mimeType,
      catalog,
    );
    return {
      query: transcription,
      transcription,
      ...this.toFilters(interpretation, catalog),
    };
  }

  private toFilters(
    i: AiSearchInterpretation,
    catalog: AiCatalogContext,
  ): Pick<AiSearchResponse, 'summary' | 'filters' | 'ignored'> {
    const ignored = [...i.keywords];

    const amenityIds: string[] = [];
    const amenityNames: string[] = [];
    for (const term of i.amenities) {
      const match = this.matchAmenity(term, catalog);
      if (!match) {
        ignored.push(term);
        continue;
      }
      if (!amenityIds.includes(match.id)) {
        amenityIds.push(match.id);
        amenityNames.push(match.name);
      }
    }

    const { checkin, checkout } = this.validDates(i.checkin, i.checkout);

    const filters: AiSearchFilters = {
      modality: i.modality,
      city: this.canonical(i.city, catalog.cities),
      neighborhood: this.canonical(i.neighborhood, catalog.neighborhoods),
      minBedrooms: i.bedrooms,
      minBathrooms: i.bathrooms,
      minGuests: i.guests,
      maxMonthlyRate:
        i.maxMonthlyRate != null ? Math.round(i.maxMonthlyRate) : null,
      checkin,
      checkout,
      stayMonths: i.stayMonths,
      amenityIds: amenityIds.slice(0, 10),
      amenityNames: amenityNames.slice(0, 10),
    };

    return { summary: i.summary, filters, ignored };
  }

  /** Nombre exacto del catálogo; si no, una única coincidencia parcial. Si es ambiguo, no filtra. */
  private matchAmenity(term: string, catalog: AiCatalogContext) {
    const needle = fold(term);
    if (!needle) return null;
    const exact = catalog.amenities.find((a) => fold(a.name) === needle);
    if (exact) return exact;
    const partial = catalog.amenities.filter((a) => {
      const name = fold(a.name);
      return name.includes(needle) || needle.includes(name);
    });
    return partial.length === 1 ? partial[0] : null;
  }

  /** Usa la grafía del catálogo si coincide; si no, conserva lo que dijo el usuario (el endpoint filtra por "contiene"). */
  private canonical(value: string | null, known: string[]): string | null {
    if (!value) return null;
    const needle = fold(value);
    return known.find((k) => fold(k) === needle) ?? value;
  }

  private validDates(checkin: string | null, checkout: string | null) {
    if (!checkin || !checkout) return { checkin: null, checkout: null };
    const valid =
      checkin >= todayIso() &&
      checkout > checkin &&
      !Number.isNaN(Date.parse(checkout));
    return valid ? { checkin, checkout } : { checkin: null, checkout: null };
  }

  private loadCatalog(): Promise<AiCatalogContext> {
    if (this.catalog && this.catalog.expires > Date.now())
      return this.catalog.value;

    const value = this.fetchCatalog();
    this.catalog = { expires: Date.now() + CATALOG_TTL_MS, value };
    value.catch(() => {
      this.catalog = null;
    });
    return value;
  }

  private async fetchCatalog(): Promise<AiCatalogContext> {
    const activeProperty = { deletedAt: null, status: PropertyStatus.ACTIVE };
    const [amenities, flexAddresses, propertyAddresses] = await Promise.all([
      this.prisma.amenity.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.propertyFlexAddress.findMany({
        where: { propertyFlex: activeProperty },
        select: { city: true, neighborhood: true },
      }),
      this.prisma.propertyAddress.findMany({
        where: { property: activeProperty },
        select: { city: true, neighborhood: true },
      }),
    ]);

    const cities = new Map<string, string>();
    const neighborhoods = new Map<string, string>();
    for (const row of [...flexAddresses, ...propertyAddresses]) {
      const city = row.city?.trim();
      const neighborhood = row.neighborhood?.trim();
      if (city) cities.set(fold(city), city);
      if (neighborhood) neighborhoods.set(fold(neighborhood), neighborhood);
    }

    return {
      amenities,
      cities: [...cities.values()].slice(0, 50),
      neighborhoods: [...neighborhoods.values()].slice(0, 150),
    };
  }

  private cacheGet(key: string): AiSearchResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    this.cache.delete(key);
    if (entry.expires <= Date.now()) return null;
    this.cache.set(key, entry); // LRU: lo vuelve a poner al final
    return entry.value;
  }

  private cacheSet(key: string, value: AiSearchResponse) {
    this.cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const [oldest] = this.cache.keys();
      this.cache.delete(oldest);
    }
  }
}
