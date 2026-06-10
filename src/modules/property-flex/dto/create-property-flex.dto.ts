import {
  IsString, IsEnum, IsOptional, IsUUID, IsInt, IsNumber,
  Min, Max, MaxLength, ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PropertyType, PropertyStatus } from '@prisma/client';

export class CreatePropertyFlexAddressDto {
  @IsString() @MaxLength(255) street: string;
  @IsOptional() @IsString() @MaxLength(20) number?: string;
  @IsOptional() @IsString() @MaxLength(50) apartment?: string;
  @IsOptional() @IsString() @MaxLength(100) neighborhood?: string;
  @IsString() @MaxLength(100) city: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsString() @MaxLength(100) country: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}

export class CreatePropertyFlexDto {
  @IsOptional() @IsUUID() companyId?: string;

  @IsString() @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsEnum(PropertyType) type: PropertyType;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;

  @IsOptional() @IsInt() floor?: number;
  @IsInt() @Min(0) @Max(20) bedrooms: number;
  @IsInt() @Min(0) @Max(10) bathrooms: number;
  @IsInt() @Min(1) @Max(50) maxOccupancy: number;
  @IsOptional() @Transform(({ value }) => value != null ? String(value) : undefined) @IsString() sizeM2?: string;

  @IsNumber() @Min(0) monthlyRate: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsInt() @Min(1) minMonths?: number;
  @IsOptional() @IsInt() @Min(1) maxMonths?: number;
  @IsOptional() @IsNumber() @Min(0) depositAmount?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePropertyFlexAddressDto)
  address?: CreatePropertyFlexAddressDto;
}
