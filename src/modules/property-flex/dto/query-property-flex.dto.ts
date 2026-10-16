import { IsEnum, IsInt, IsOptional, IsUUID, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, PropertyStatus } from '@prisma/client';
import { CatalogSearchFiltersDto } from '../../../common/catalog/catalog-search-filters';

export class QueryPropertyFlexDto extends CatalogSearchFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxMonthlyRate?: number;
  @IsOptional() @IsIn(['createdAt', 'availability']) sortBy?: 'createdAt' | 'availability' = 'availability';
}
