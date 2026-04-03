import { PropertyType } from '@prisma/client';
export declare class CreatePropertyAddressDto {
    street: string;
    number?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    state?: string;
    country: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
}
export declare class CreatePropertyDto {
    companyId?: string;
    name: string;
    description?: string;
    type: PropertyType;
    address?: CreatePropertyAddressDto;
}
