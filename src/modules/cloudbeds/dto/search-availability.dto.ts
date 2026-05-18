import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SearchAvailabilityDto {
  @ApiProperty({ description: 'Cloudbeds widget property id (e.g. "179484")' })
  @IsString()
  @Length(1, 50)
  propertyId: string;

  @ApiProperty({ example: '2026-05-16', description: 'Checkin date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkin: string;

  @ApiProperty({ example: '2026-05-18', description: 'Checkout date (YYYY-MM-DD)' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkout: string;

  @ApiPropertyOptional({ example: 'ARS', default: 'ARS' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ example: 'es', default: 'es' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  lang?: string;

  @ApiPropertyOptional({ example: 2, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;
}
