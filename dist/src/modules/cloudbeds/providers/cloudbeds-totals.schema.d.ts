import { z } from 'zod';
declare const TaxFeeItemSchema: z.ZodObject<{
    id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    name: z.ZodOptional<z.ZodString>;
    credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
declare const TaxFeeGroupSchema: z.ZodObject<{
    total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    data: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        name: z.ZodOptional<z.ZodString>;
        credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
declare const RoomBreakdownSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    adults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    kids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    count: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    rateId: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
    isPrivate: z.ZodOptional<z.ZodBoolean>;
    addons: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    rateWithoutInclusiveTaxAndFees: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
}, z.core.$strip>;
declare const TotalsDataSchema: z.ZodObject<{
    checkIn: z.ZodOptional<z.ZodString>;
    checkOut: z.ZodOptional<z.ZodString>;
    days: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    rooms: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        adults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        kids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        count: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        rateId: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
        isPrivate: z.ZodOptional<z.ZodBoolean>;
        addons: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        rateWithoutInclusiveTaxAndFees: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    }, z.core.$strip>>>;
    addAdults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    addAdultsPrice: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    addKids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    addKidsPrice: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    taxes: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        data: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
            name: z.ZodOptional<z.ZodString>;
            credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    fees: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        data: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
            name: z.ZodOptional<z.ZodString>;
            credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    deposit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    grandTotal: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    totalAdults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    totalKids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    cntRooms: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    totalGuests: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    addons: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    smartPolicyCaptureCreditCard: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    paymentSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    expectedPaymentSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    cancellationSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    externalOffers: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    currencyRate: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    roomsTaxes: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    policySource: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
    policyExceptionName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cart_token: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const CloudbedsTotalsResponseSchema: z.ZodObject<{
    success: z.ZodOptional<z.ZodBoolean>;
    data: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        checkIn: z.ZodOptional<z.ZodString>;
        checkOut: z.ZodOptional<z.ZodString>;
        days: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        rooms: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            adults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            kids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            count: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            rateId: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
            isPrivate: z.ZodOptional<z.ZodBoolean>;
            addons: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
            rateWithoutInclusiveTaxAndFees: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        }, z.core.$strip>>>;
        addAdults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        addAdultsPrice: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        addKids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        addKidsPrice: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        taxes: z.ZodNullable<z.ZodOptional<z.ZodObject<{
            total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            data: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                name: z.ZodOptional<z.ZodString>;
                credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
                name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        fees: z.ZodNullable<z.ZodOptional<z.ZodObject<{
            total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
            data: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
                name: z.ZodOptional<z.ZodString>;
                credit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
                name_langs: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>>;
        total: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        deposit: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        grandTotal: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        totalAdults: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        totalKids: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        cntRooms: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        totalGuests: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        addons: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        smartPolicyCaptureCreditCard: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
        paymentSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
        expectedPaymentSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
        cancellationSchedule: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
        externalOffers: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
        currencyRate: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
        roomsTaxes: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
        policySource: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
        policyExceptionName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        cart_token: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>>;
    statusMessage: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    statusCode: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<number | null, string | number>>>>;
    errorCode: z.ZodNullable<z.ZodOptional<z.ZodUnknown>>;
}, z.core.$strip>;
export type RawCloudbedsTotalsResponse = z.infer<typeof CloudbedsTotalsResponseSchema>;
export type RawTotalsData = z.infer<typeof TotalsDataSchema>;
export type RawTaxFeeGroup = z.infer<typeof TaxFeeGroupSchema>;
export type RawTaxFeeItem = z.infer<typeof TaxFeeItemSchema>;
export type RawRoomBreakdown = z.infer<typeof RoomBreakdownSchema>;
export {};
