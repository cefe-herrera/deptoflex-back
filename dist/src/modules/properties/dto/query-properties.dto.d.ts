import { PropertyStatus, PropertyType } from '@prisma/client';
export declare class QueryPropertiesDto {
    companyId?: string;
    status?: PropertyStatus;
    type?: PropertyType;
    city?: string;
    page?: number;
    limit?: number;
}
