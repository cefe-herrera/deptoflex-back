import { UnitStatus, RentalModality } from '@prisma/client';
export declare class CreateUnitDto {
    propertyId: string;
    name: string;
    description?: string;
    floor?: number;
    bedrooms: number;
    bathrooms: number;
    maxOccupancy: number;
    sizeM2?: string;
    status?: UnitStatus;
    rentalModality?: RentalModality;
}
