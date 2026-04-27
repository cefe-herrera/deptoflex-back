import { IsString, IsEnum, IsOptional, IsUUID, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UnitStatus, RentalModality } from '@prisma/client';

export class CreateUnitDto {
  @IsUUID() propertyId: string;

  @IsString() @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() floor?: number;
  @IsInt() @Min(0) @Max(20) bedrooms: number;
  @IsInt() @Min(0) @Max(10) bathrooms: number;
  @IsInt() @Min(1) @Max(50) maxOccupancy: number;
  @IsOptional() @Transform(({ value }) => value != null ? String(value) : undefined) @IsString() sizeM2?: string;
  @IsOptional() @IsEnum(UnitStatus) status?: UnitStatus;
  @IsOptional() @IsEnum(RentalModality) rentalModality?: RentalModality;
}
