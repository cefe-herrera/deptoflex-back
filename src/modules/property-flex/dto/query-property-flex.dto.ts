import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, PropertyStatus } from '@prisma/client';

export class QueryPropertyFlexDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxMonthlyRate?: number;
}
