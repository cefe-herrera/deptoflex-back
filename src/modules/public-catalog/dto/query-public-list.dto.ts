import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, RentalModality } from '@prisma/client';

export class QueryPublicFlexListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 50;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxMonthlyRate?: number;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
}

export class QueryPublicPropertiesListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 100;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
}

export class QueryPublicUnitsListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 100;
  @IsOptional() @IsEnum(RentalModality) rentalModality?: RentalModality;
}
