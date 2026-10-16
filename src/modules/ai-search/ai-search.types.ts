import { z } from 'zod';

/** Entero opcional tolerante: "2" → 2, 2.6 → 3, valores inválidos → null (no rompe la búsqueda). */
const looseInt = (min: number) =>
  z
    .preprocess((v) => {
      if (v == null || v === '') return null;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    }, z.number().int().min(min).nullable())
    .catch(null);

const looseNumber = z
  .preprocess((v) => {
    if (v == null || v === '') return null;
    if (typeof v !== 'number' && typeof v !== 'string') return null;
    const n =
      typeof v === 'number'
        ? v
        : Number(v.replace(/[.\s$]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }, z.number().positive().nullable())
  .catch(null);

const looseText = z
  .preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null),
    z.string().nullable(),
  )
  .catch(null);

const looseDate = z
  .preprocess(
    (v) => (typeof v === 'string' ? v.trim() : null),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  )
  .catch(null);

const looseStringList = z
  .preprocess(
    (v) =>
      Array.isArray(v)
        ? v
            .filter((s): s is string => typeof s === 'string' && !!s.trim())
            .map((s) => s.trim())
        : [],
    z.array(z.string()),
  )
  .catch([]);

/** Lo que devuelve el modelo. Cada campo se valida por separado: uno inválido se descarta, no tira 500. */
export const AiSearchInterpretationSchema = z.object({
  modality: z.enum(['flex', 'temporal']).nullable().catch(null),
  city: looseText,
  neighborhood: looseText,
  bedrooms: looseInt(0),
  bathrooms: looseInt(0),
  guests: looseInt(1),
  maxMonthlyRate: looseNumber,
  checkin: looseDate,
  checkout: looseDate,
  stayMonths: looseInt(1),
  amenities: looseStringList,
  keywords: looseStringList,
  summary: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim().slice(0, 300) : ''),
      z.string(),
    )
    .catch(''),
});

export type AiSearchInterpretation = z.infer<
  typeof AiSearchInterpretationSchema
>;

/**
 * Filtros listos para los endpoints del catálogo (mismos nombres que `CatalogSearchFiltersDto`),
 * más los que el front aplica localmente (modalidad, precio, fechas).
 */
export type AiSearchFilters = {
  modality: 'flex' | 'temporal' | null;
  city: string | null;
  neighborhood: string | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  minGuests: number | null;
  maxMonthlyRate: number | null;
  checkin: string | null;
  checkout: string | null;
  stayMonths: number | null;
  amenityIds: string[];
  /** Nombres (catálogo) de `amenityIds`, en el mismo orden, para mostrar chips. */
  amenityNames: string[];
};

export type AiSearchResponse = {
  query: string;
  transcription?: string;
  summary: string;
  filters: AiSearchFilters;
  /** Términos que el usuario pidió pero no se pudieron traducir a un filtro (p. ej. "luminoso"). */
  ignored: string[];
};

export type AiCatalogContext = {
  amenities: Array<{ id: string; name: string }>;
  cities: string[];
  neighborhoods: string[];
};
