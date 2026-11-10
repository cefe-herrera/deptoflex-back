import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PartnerBookingStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PartnerBookingGuestDto {
  @ApiProperty({ example: 'Ana' })
  @IsString()
  @Transform(trim)
  @Length(1, 100)
  firstName!: string;

  @ApiProperty({ example: 'García' })
  @IsString()
  @Transform(trim)
  @Length(1, 100)
  lastName!: string;

  @ApiProperty({ example: 'ana@mail.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '+5491155550000' })
  @IsString()
  @Transform(trim)
  @Length(5, 40)
  phone!: string;

  @ApiPropertyOptional({ example: '30111222', description: 'DNI o pasaporte' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(40)
  document?: string;

  @ApiPropertyOptional({ example: 'Argentina' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(60)
  nationality?: string;
}

export class PartnerBookingPricingDto {
  @ApiProperty({
    example: 'ARS',
    description: 'Moneda (la misma de la consulta de disponibilidad)',
  })
  @IsString()
  @Length(3, 3)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currency!: string;

  @ApiProperty({
    example: 200000,
    description:
      'Total de la reserva: el totalAmount de la habitación en /partner/availability',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  finalPrice!: number;

  @ApiProperty({
    example: 30000,
    description:
      'Comisión que le cobrás al huésped como reserva y te quedás. Weflex cobra el resto (finalPrice - partnerCommission).',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  partnerCommission!: number;
}

export class CreatePartnerBookingDto {
  @ApiProperty({ description: 'ID de la propiedad (GET /partner/properties)' })
  @IsUUID()
  propertyId!: string;

  @ApiProperty({
    description: 'roomTypeId de la habitación (GET /partner/availability)',
  })
  @IsString()
  @Length(1, 50)
  roomTypeId!: string;

  @ApiPropertyOptional({
    description: 'rateId de la tarifa (GET /partner/availability)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  rateId?: string;

  @ApiProperty({ example: '2026-12-16' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkin!: string;

  @ApiProperty({ example: '2026-12-18' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkout!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(20)
  adults!: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;

  @ApiProperty({ type: PartnerBookingGuestDto })
  @ValidateNested()
  @Type(() => PartnerBookingGuestDto)
  guest!: PartnerBookingGuestDto;

  @ApiProperty({ type: PartnerBookingPricingDto })
  @ValidateNested()
  @Type(() => PartnerBookingPricingDto)
  pricing!: PartnerBookingPricingDto;

  @ApiPropertyOptional({
    example: 'XYZ-10293',
    description:
      'Tu referencia interna. Si reenviás la misma, se devuelve la solicitud existente (no se duplica).',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(1, 100)
  externalReference?: string;

  @ApiPropertyOptional({ description: 'Pedidos especiales del huésped' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CancelPartnerBookingDto {
  @ApiProperty({ example: 'El huésped canceló el viaje' })
  @IsString()
  @Transform(trim)
  @Length(3, 1000)
  reason!: string;
}

export class ListPartnerBookingsQueryDto {
  @ApiPropertyOptional({ enum: PartnerBookingStatus })
  @IsOptional()
  @IsEnum(PartnerBookingStatus)
  status?: PartnerBookingStatus;

  @ApiPropertyOptional({ description: 'Filtrar por tu referencia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalReference?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export class AdminListPartnerBookingsQueryDto extends ListPartnerBookingsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class ConfirmPartnerBookingDto {
  @ApiProperty({ description: 'Número de reserva creado en Cloudbeds' })
  @IsString()
  @Transform(trim)
  @Length(1, 100)
  cloudbedsReservationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}

export class RejectPartnerBookingDto {
  @ApiProperty({ description: 'Motivo (se informa al partner)' })
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class ConfirmPartnerCancellationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
