import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO31661Alpha2,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PrepareBookingRoomDto {
  @ApiProperty({ description: 'Cloudbeds rate id selected by the guest', example: '551718' })
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

  @ApiPropertyOptional({
    description: 'Cloudbeds add-ons payload for this room/rate',
    default: [],
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  addons?: unknown[];
}

export class PrepareBookingDto {
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

  @ApiProperty({ description: 'Cart token returned by /booking/calculate-totals' })
  @IsString()
  @Length(1, 500)
  cartToken: string;

  @ApiProperty({
    description: 'Selected Cloudbeds rates grouped by the backend before sending to /booking/prepare',
    type: [PrepareBookingRoomDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PrepareBookingRoomDto)
  rooms: PrepareBookingRoomDto[];

  @ApiProperty({ example: 'Ceferino Armando' })
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty({ example: 'Herrera' })
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({ example: 'c3f3.dev@gmail.com' })
  @IsEmail()
  @Length(3, 255)
  email: string;

  @ApiProperty({ example: '+543874025678' })
  @IsString()
  @Length(5, 30)
  phone: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country code', example: 'AR' })
  @IsISO31661Alpha2()
  country: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  bookingEstimatedArrivalTime?: number;

  @ApiPropertyOptional({ example: 'acb86933-2a32-4704-9b62-00b9d026e813' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  paymentSdk?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cfarOffersPresented?: boolean;

  @ApiPropertyOptional({ default: 'hosted' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  bookingEngineSource?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  iframe?: boolean;
}
