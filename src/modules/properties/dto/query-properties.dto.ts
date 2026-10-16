import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { PropertyStatus, PropertyType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { CatalogSearchFiltersDto } from '../../../common/catalog/catalog-search-filters';

export class QueryPropertiesDto extends CatalogSearchFiltersDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
