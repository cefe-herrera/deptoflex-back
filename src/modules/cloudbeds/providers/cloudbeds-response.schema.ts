import { z } from 'zod';

/**
 * Zod schema for the Cloudbeds public booking-engine response.
 *
 * The endpoint `POST https://hotels.cloudbeds.com/booking/rooms` is **not**
 * an official contract. It can change without notice. Every field we don't
 * strictly need is declared optional/nullish and we strip unknown keys
 * (Zod's default) so the parsed payload stays predictable.
 *
 * If Cloudbeds adds new fields they are silently ignored. If they remove
 * required fields the parse fails loudly (and the provider returns a
 * `ServiceUnavailableException`).
 */

const StringOrNumber = z.union([z.string(), z.number()]);

/**
 * Cloudbeds returns numeric fields sometimes as `number` and sometimes as
 * stringified numbers (e.g. `"60000.00"` for `base_rate` on package rates).
 * Coerce both into a finite number; rejects non-numeric strings.
 */
const NumericStrict = StringOrNumber.transform((v, ctx) => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: 'custom', message: 'Expected numeric value' });
    return z.NEVER;
  }
  return n;
});

/** Same as NumericStrict but allows null/undefined and coerces invalid to null. */
const NumericLoose = StringOrNumber.transform((v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const DetailedRateSchema = z.object({
  date: z.string(),
  rate: NumericStrict,
  base_rate: NumericLoose.optional().nullable(),
});

const RoomTypeSchema = z.object({
  room_type_id: StringOrNumber,
  rate_id: StringOrNumber.optional().nullable(),
  room_type_name: z.string().optional(),
  room_type_title: z.string().optional(),
  room_type_desc: z.string().optional().nullable(),
  rate_basic: z.number().optional().nullable(),
  rate_min: z.number().optional().nullable(),
  rate_max: z.number().optional().nullable(),
  detailed_rates: z.array(DetailedRateSchema).optional(),
  num_available_now: z.number().optional(),
  remaining: z.number().optional(),
  max_rooms: z.number().optional(),
  max_guests: StringOrNumber.optional(),
  max_adults: StringOrNumber.optional(),
  max_children: StringOrNumber.optional(),
  featured_photo: z.string().optional().nullable(),
  featured_photo_big: z.string().optional().nullable(),
  photos_gallery: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  unit_ids: z.array(z.string()).optional(),
});

const MaRateChannelSchema = z.object({
  channel_name: z.string(),
  channel_price: z.number(),
});

const MaRateSchema = z.object({
  id: StringOrNumber,
  name: z.string(),
  rates: z.array(MaRateChannelSchema).optional(),
  direct: z.number().optional().nullable(),
});

/**
 * Cloudbeds returns `ma_rates: false` when OTA comparison is unavailable,
 * and an array otherwise. Normalize both to an array.
 */
const MaRatesField = z
  .union([z.array(MaRateSchema), z.boolean()])
  .optional()
  .transform((v) => (Array.isArray(v) ? v : []));

export const CloudbedsResponseSchema = z.object({
  total: z.number().optional(),
  room_types: z.array(RoomTypeSchema).optional(),
  currency_rate: z.number().optional().nullable(),
  website_source_id: StringOrNumber.optional().nullable(),
  ma_rates: MaRatesField,
});

export type RawDetailedRate = z.infer<typeof DetailedRateSchema>;
export type RawRoomType = z.infer<typeof RoomTypeSchema>;
export type RawMaRate = z.infer<typeof MaRateSchema>;
export type RawMaRateChannel = z.infer<typeof MaRateChannelSchema>;
export type RawCloudbedsResponse = z.infer<typeof CloudbedsResponseSchema>;
