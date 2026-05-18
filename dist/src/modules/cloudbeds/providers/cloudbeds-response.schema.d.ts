import { z } from 'zod';
declare const DetailedRateSchema: z.ZodObject<{
    date: z.ZodString;
    rate: z.ZodNumber;
    base_rate: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
declare const RoomTypeSchema: z.ZodObject<{
    room_type_id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    rate_id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    room_type_name: z.ZodOptional<z.ZodString>;
    room_type_title: z.ZodOptional<z.ZodString>;
    room_type_desc: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rate_basic: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    rate_min: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    rate_max: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    detailed_rates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        rate: z.ZodNumber;
        base_rate: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
    num_available_now: z.ZodOptional<z.ZodNumber>;
    remaining: z.ZodOptional<z.ZodNumber>;
    max_rooms: z.ZodOptional<z.ZodNumber>;
    max_guests: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    max_adults: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    max_children: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    featured_photo: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    featured_photo_big: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    photos_gallery: z.ZodOptional<z.ZodArray<z.ZodString>>;
    features: z.ZodOptional<z.ZodArray<z.ZodString>>;
    unit_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
declare const MaRateChannelSchema: z.ZodObject<{
    channel_name: z.ZodString;
    channel_price: z.ZodNumber;
}, z.core.$strip>;
declare const MaRateSchema: z.ZodObject<{
    id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    name: z.ZodString;
    rates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        channel_name: z.ZodString;
        channel_price: z.ZodNumber;
    }, z.core.$strip>>>;
    direct: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const CloudbedsResponseSchema: z.ZodObject<{
    total: z.ZodOptional<z.ZodNumber>;
    room_types: z.ZodOptional<z.ZodArray<z.ZodObject<{
        room_type_id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        rate_id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        room_type_name: z.ZodOptional<z.ZodString>;
        room_type_title: z.ZodOptional<z.ZodString>;
        room_type_desc: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        rate_basic: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        rate_min: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        rate_max: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        detailed_rates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            rate: z.ZodNumber;
            base_rate: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>>;
        num_available_now: z.ZodOptional<z.ZodNumber>;
        remaining: z.ZodOptional<z.ZodNumber>;
        max_rooms: z.ZodOptional<z.ZodNumber>;
        max_guests: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        max_adults: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        max_children: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        featured_photo: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        featured_photo_big: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        photos_gallery: z.ZodOptional<z.ZodArray<z.ZodString>>;
        features: z.ZodOptional<z.ZodArray<z.ZodString>>;
        unit_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    currency_rate: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    website_source_id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    ma_rates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        name: z.ZodString;
        rates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            channel_name: z.ZodString;
            channel_price: z.ZodNumber;
        }, z.core.$strip>>>;
        direct: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RawDetailedRate = z.infer<typeof DetailedRateSchema>;
export type RawRoomType = z.infer<typeof RoomTypeSchema>;
export type RawMaRate = z.infer<typeof MaRateSchema>;
export type RawMaRateChannel = z.infer<typeof MaRateChannelSchema>;
export type RawCloudbedsResponse = z.infer<typeof CloudbedsResponseSchema>;
export {};
