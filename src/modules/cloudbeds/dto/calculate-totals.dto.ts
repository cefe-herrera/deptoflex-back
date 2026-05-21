import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CalculateTotalsRateDto {
  @ApiProperty({ description: 'Cloudbeds rateId for the chosen room/rate', example: '551718' })
  @IsString()
  @Length(1, 50)
  rateId: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  adults: number;

  @ApiPropertyOptional({ example: 0, default: 0, minimum: 0, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  kids?: number;
}

export class CalculateTotalsDto {
  @ApiProperty({ description: 'Cloudbeds widget property id (e.g. "179484")' })
  @IsString()
  @Length(1, 50)
  propertyId: string;

  @ApiProperty({ example: '2026-05-20' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkin: string;

  @ApiProperty({ example: '2026-05-21' })
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

  @ApiProperty({
    description: 'Selected rates to price. At least one required.',
    type: [CalculateTotalsRateDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CalculateTotalsRateDto)
  rates: CalculateTotalsRateDto[];
}
