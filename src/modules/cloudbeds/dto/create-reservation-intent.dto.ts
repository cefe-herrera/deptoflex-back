import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateReservationIntentDto {
  @ApiProperty()
  @IsUUID()
  propertyId: string;

  @ApiProperty({ description: 'Cloudbeds room_type_id from the search response' })
  @IsString()
  @Length(1, 50)
  roomTypeId: string;

  @ApiPropertyOptional({ description: 'Cloudbeds rate_id from the search response' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  rateId?: string;

  @ApiProperty({ example: '2026-05-16' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkin: string;

  @ApiProperty({ example: '2026-05-18' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkout: string;

  @ApiPropertyOptional({ default: 'ARS' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @ApiPropertyOptional({ default: 'es' })
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

  @ApiPropertyOptional({ example: 95000, description: 'Expected total amount (optional, validated server-side)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
