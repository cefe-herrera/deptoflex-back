import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max, IsString } from 'class-validator';
import { PropertyStatus, PropertyType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class QueryPropertiesDto {
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsEnum(PropertyStatus) status?: PropertyStatus;
  @IsOptional() @IsEnum(PropertyType) type?: PropertyType;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Transform(({ value }) => parseInt(value)) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
