import { IsEnum, IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, RentalModality } from '@prisma/client';
import { CatalogSearchFiltersDto } from '../../../common/catalog/catalog-search-filters';

export class QueryPublicFlexListDto extends CatalogSearchFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 50;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxMonthlyRate?: number;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
  @IsOptional() @IsIn(['createdAt', 'availability']) sortBy?: 'createdAt' | 'availability' = 'availability';
}

export class QueryPublicPropertiesListDto extends CatalogSearchFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 100;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
}

export class QueryPublicUnitsListDto extends CatalogSearchFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 100;
  @IsOptional() @IsEnum(RentalModality) rentalModality?: RentalModality;
}
