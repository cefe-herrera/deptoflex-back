export declare class CalculateTotalsRateDto {
    rateId: string;
    adults: number;
    kids?: number;
}
export declare class CalculateTotalsDto {
    propertyId: string;
    checkin: string;
    checkout: string;
    currencyCode?: string;
    lang?: string;
    rates: CalculateTotalsRateDto[];
}
