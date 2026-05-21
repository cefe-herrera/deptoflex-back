import { z } from 'zod';

/**
 * Zod schema for the Cloudbeds public booking-engine `calculateTotals` response.
 *
 * Endpoint: `POST https://hotels.cloudbeds.com/booking/calculateTotals`.
 * Same caveats as `cloudbeds-response.schema`: not an official contract,
 * numeric fields sometimes arrive as strings, optional fields default to
 * `null`/`undefined`. Unknown keys are silently stripped (Zod default).
 */

const StringOrNumber = z.union([z.string(), z.number()]);

const NumericLoose = StringOrNumber.transform((v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
});

const TaxFeeItemSchema = z.object({
  id: StringOrNumber.optional().nullable(),
  name: z.string().optional(),
  credit: NumericLoose.optional().nullable(),
  name_langs: z.string().optional().nullable(),
});

const TaxFeeGroupSchema = z.object({
  total: NumericLoose.optional().nullable(),
  data: z.array(TaxFeeItemSchema).optional(),
});

const RoomBreakdownSchema = z.object({
  name: z.string().optional(),
  adults: NumericLoose.optional().nullable(),
  kids: NumericLoose.optional().nullable(),
  count: NumericLoose.optional().nullable(),
  rateId: StringOrNumber.optional().nullable(),
  isPrivate: z.boolean().optional(),
  addons: z.array(z.unknown()).optional(),
  rateWithoutInclusiveTaxAndFees: NumericLoose.optional().nullable(),
});

const TotalsDataSchema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  days: NumericLoose.optional().nullable(),
  rooms: z.array(RoomBreakdownSchema).optional(),
  addAdults: NumericLoose.optional().nullable(),
  addAdultsPrice: NumericLoose.optional().nullable(),
  addKids: NumericLoose.optional().nullable(),
  addKidsPrice: NumericLoose.optional().nullable(),
  taxes: TaxFeeGroupSchema.optional().nullable(),
  fees: TaxFeeGroupSchema.optional().nullable(),
  total: NumericLoose.optional().nullable(),
  deposit: NumericLoose.optional().nullable(),
  grandTotal: NumericLoose.optional().nullable(),
  totalAdults: NumericLoose.optional().nullable(),
  totalKids: NumericLoose.optional().nullable(),
  cntRooms: NumericLoose.optional().nullable(),
  totalGuests: NumericLoose.optional().nullable(),
  addons: z.array(z.unknown()).optional(),
  smartPolicyCaptureCreditCard: z.boolean().optional().nullable(),
  paymentSchedule: z.unknown().optional().nullable(),
  expectedPaymentSchedule: z.unknown().optional().nullable(),
  cancellationSchedule: z.unknown().optional().nullable(),
  externalOffers: z.unknown().optional().nullable(),
  currencyRate: NumericLoose.optional().nullable(),
  roomsTaxes: z.array(z.unknown()).optional(),
  policySource: z.unknown().optional().nullable(),
  policyExceptionName: z.string().optional().nullable(),
  cart_token: z.string().optional().nullable(),
});

export const CloudbedsTotalsResponseSchema = z.object({
  success: z.boolean().optional(),
  data: TotalsDataSchema.optional().nullable(),
  statusMessage: z.string().optional().nullable(),
  statusCode: NumericLoose.optional().nullable(),
  errorCode: z.unknown().optional().nullable(),
});

export type RawCloudbedsTotalsResponse = z.infer<typeof CloudbedsTotalsResponseSchema>;
export type RawTotalsData = z.infer<typeof TotalsDataSchema>;
export type RawTaxFeeGroup = z.infer<typeof TaxFeeGroupSchema>;
export type RawTaxFeeItem = z.infer<typeof TaxFeeItemSchema>;
export type RawRoomBreakdown = z.infer<typeof RoomBreakdownSchema>;
