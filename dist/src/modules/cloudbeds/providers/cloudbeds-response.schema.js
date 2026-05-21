"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbedsResponseSchema = void 0;
const zod_1 = require("zod");
const StringOrNumber = zod_1.z.union([zod_1.z.string(), zod_1.z.number()]);
const NumericStrict = StringOrNumber.transform((v, ctx) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) {
        ctx.addIssue({ code: 'custom', message: 'Expected numeric value' });
        return zod_1.z.NEVER;
    }
    return n;
});
const NumericLoose = StringOrNumber.transform((v) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
});
const DetailedRateSchema = zod_1.z.object({
    date: zod_1.z.string(),
    rate: NumericStrict,
    base_rate: NumericLoose.optional().nullable(),
});
const RoomTypeSchema = zod_1.z.object({
    room_type_id: StringOrNumber,
    rate_id: StringOrNumber.optional().nullable(),
    room_type_name: zod_1.z.string().optional(),
    room_type_title: zod_1.z.string().optional(),
    room_type_desc: zod_1.z.string().optional().nullable(),
    rate_basic: zod_1.z.number().optional().nullable(),
    rate_min: zod_1.z.number().optional().nullable(),
    rate_max: zod_1.z.number().optional().nullable(),
    detailed_rates: zod_1.z.array(DetailedRateSchema).optional(),
    num_available_now: zod_1.z.number().optional(),
    remaining: zod_1.z.number().optional(),
    max_rooms: zod_1.z.number().optional(),
    max_guests: StringOrNumber.optional(),
    max_adults: StringOrNumber.optional(),
    max_children: StringOrNumber.optional(),
    featured_photo: zod_1.z.string().optional().nullable(),
    featured_photo_big: zod_1.z.string().optional().nullable(),
    photos_gallery: zod_1.z.array(zod_1.z.string()).optional(),
    features: zod_1.z.array(zod_1.z.string()).optional(),
    unit_ids: zod_1.z.array(zod_1.z.string()).optional(),
});
const MaRateChannelSchema = zod_1.z.object({
    channel_name: zod_1.z.string(),
    channel_price: zod_1.z.number(),
});
const MaRateSchema = zod_1.z.object({
    id: StringOrNumber,
    name: zod_1.z.string(),
    rates: zod_1.z.array(MaRateChannelSchema).optional(),
    direct: zod_1.z.number().optional().nullable(),
});
const MaRatesField = zod_1.z
    .union([zod_1.z.array(MaRateSchema), zod_1.z.boolean()])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : []));
exports.CloudbedsResponseSchema = zod_1.z.object({
    total: zod_1.z.number().optional(),
    room_types: zod_1.z.array(RoomTypeSchema).optional(),
    currency_rate: zod_1.z.number().optional().nullable(),
    website_source_id: StringOrNumber.optional().nullable(),
    ma_rates: MaRatesField,
});
//# sourceMappingURL=cloudbeds-response.schema.js.map