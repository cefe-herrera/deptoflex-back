import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { AmenityCategory } from '@prisma/client';

export class CreateAmenityDto {
  @IsString() @MaxLength(100) name: string;
  @IsEnum(AmenityCategory) category: AmenityCategory;
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
}
