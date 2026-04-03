import { RateType } from '@prisma/client';
export declare class PricingRuleDto {
    name?: string;
    startDate?: string;
    endDate?: string;
    baseRate: number;
    currency?: string;
    rateType: RateType;
    minNights: number;
    maxNights?: number;
    isDefault: boolean;
}
export declare class SetPricingRulesDto {
    rules: PricingRuleDto[];
}
