import { AmenityCategory } from '@prisma/client';
export declare class CreateAmenityDto {
    name: string;
    category: AmenityCategory;
    icon?: string;
}
