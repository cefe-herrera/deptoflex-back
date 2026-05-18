export declare class CreateReservationIntentDto {
    propertyId: string;
    roomTypeId: string;
    rateId?: string;
    checkin: string;
    checkout: string;
    currencyCode?: string;
    lang?: string;
    adults?: number;
    children?: number;
    totalAmount?: number;
}
