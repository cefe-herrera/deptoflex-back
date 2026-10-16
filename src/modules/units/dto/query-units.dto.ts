import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RentalModality, UnitStatus } from '@prisma/client';
import { CatalogSearchFiltersDto } from '../../../common/catalog/catalog-search-filters';

export class QueryUnitsDto extends CatalogSearchFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    20;
  @IsOptional() @IsUUID() propertyId?: string;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
  @IsOptional() @IsEnum(RentalModality) rentalModality?: RentalModality;
}
