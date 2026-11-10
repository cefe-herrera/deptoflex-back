import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class PartnerAvailabilityQueryDto {
  @ApiProperty({
    description: 'ID de la propiedad (de GET /partner/properties)',
  })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({ example: '2026-12-16', description: 'Checkin (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkin!: string;

  @ApiProperty({ example: '2026-12-18', description: 'Checkout (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkout!: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;

  @ApiPropertyOptional({ example: 'ARS', default: 'ARS' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;
}
