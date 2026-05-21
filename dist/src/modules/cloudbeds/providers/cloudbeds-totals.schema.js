"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsTotalsResponseSchema = void 0;
const zod_1 = require("zod");
const StringOrNumber = zod_1.z.union([zod_1.z.string(), zod_1.z.number()]);
const NumericLoose = StringOrNumber.transform((v) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
});
const TaxFeeItemSchema = zod_1.z.object({
    id: StringOrNumber.optional().nullable(),
    name: zod_1.z.string().optional(),
    credit: NumericLoose.optional().nullable(),
    name_langs: zod_1.z.string().optional().nullable(),
});
const TaxFeeGroupSchema = zod_1.z.object({
    total: NumericLoose.optional().nullable(),
    data: zod_1.z.array(TaxFeeItemSchema).optional(),
});
const RoomBreakdownSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    adults: NumericLoose.optional().nullable(),
    kids: NumericLoose.optional().nullable(),
    count: NumericLoose.optional().nullable(),
    rateId: StringOrNumber.optional().nullable(),
    isPrivate: zod_1.z.boolean().optional(),
    addons: zod_1.z.array(zod_1.z.unknown()).optional(),
    rateWithoutInclusiveTaxAndFees: NumericLoose.optional().nullable(),
});
const TotalsDataSchema = zod_1.z.object({
    checkIn: zod_1.z.string().optional(),
    checkOut: zod_1.z.string().optional(),
    days: NumericLoose.optional().nullable(),
    rooms: zod_1.z.array(RoomBreakdownSchema).optional(),
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
    addons: zod_1.z.array(zod_1.z.unknown()).optional(),
    smartPolicyCaptureCreditCard: zod_1.z.boolean().optional().nullable(),
    paymentSchedule: zod_1.z.unknown().optional().nullable(),
    expectedPaymentSchedule: zod_1.z.unknown().optional().nullable(),
    cancellationSchedule: zod_1.z.unknown().optional().nullable(),
    externalOffers: zod_1.z.unknown().optional().nullable(),
    currencyRate: NumericLoose.optional().nullable(),
    roomsTaxes: zod_1.z.array(zod_1.z.unknown()).optional(),
    policySource: zod_1.z.unknown().optional().nullable(),
    policyExceptionName: zod_1.z.string().optional().nullable(),
    cart_token: zod_1.z.string().optional().nullable(),
});
exports.CloudbedsTotalsResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean().optional(),
    data: TotalsDataSchema.optional().nullable(),
    statusMessage: zod_1.z.string().optional().nullable(),
    statusCode: NumericLoose.optional().nullable(),
    errorCode: zod_1.z.unknown().optional().nullable(),
});
//# sourceMappingURL=cloudbeds-totals.schema.js.map