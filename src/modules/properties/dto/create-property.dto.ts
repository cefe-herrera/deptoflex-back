import {
  IsString, IsEnum, IsOptional, IsUUID, MaxLength, ValidateNested,
  IsNumber, Min, Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PropertyType } from '@prisma/client';

export class CreatePropertyAddressDto {
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

export class CreatePropertyDto {
  @IsOptional() @IsUUID() companyId?: string;

  @IsString() @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional() @IsString() description?: string;
  @IsEnum(PropertyType) type: PropertyType;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePropertyAddressDto)
  address?: CreatePropertyAddressDto;
}
