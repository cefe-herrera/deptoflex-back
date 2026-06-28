import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReservationSessionModeDto {
  AMBASSADOR = 'ambassador',
  GUEST = 'guest',
}

/**
 * Sesión de reserva que el embajador crea ANTES de abrir el motor de Cloudbeds.
 * El backend genera sessionId + trackingToken y construye la URL segura.
 *
 * Formato legacy (compat): { sessionId, cloudbedsUrl } sin bookingSlug.
 */
export class CreateReservationSessionDto {
  @ApiPropertyOptional({
    enum: ReservationSessionModeDto,
    default: ReservationSessionModeDto.AMBASSADOR,
    description: 'ambassador = el embajador carga la reserva; guest = link para el huésped.',
  })
  @IsOptional()
  @IsEnum(ReservationSessionModeDto)
  mode?: ReservationSessionModeDto;

  @ApiPropertyOptional({
    description: 'Slug del motor Cloudbeds (ej. SYhMUF). Si falta, se resuelve por propertyId.',
  })
  @ValidateIf(
    (o: CreateReservationSessionDto) => !o.cloudbedsUrl && !o.propertyId,
  )
  @IsString()
  @MaxLength(100)
  bookingSlug?: string;

  @ApiPropertyOptional({ description: 'UUID local de Property en DeptoFlex.' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  checkin?: string;

  @ApiPropertyOptional({ example: '2026-07-03' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  checkout?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  roomTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({
    description: 'URL pública de agradecimiento para huéspedes (mode=guest).',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  guestReturnUrl?: string;

  /** @deprecated Legacy: UUID generado en frontend. Preferir que el backend lo genere. */
  @ApiPropertyOptional({
    description: 'Legacy: UUID generado en frontend. Si se omite, el backend lo genera.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  /** @deprecated Legacy: URL ya construida en frontend. Usar bookingSlug + contexto. */
  @ApiPropertyOptional({
    description: 'Legacy: URL del motor ya construida en frontend.',
  })
  @ValidateIf(
    (o: CreateReservationSessionDto) => !o.bookingSlug && !o.propertyId,
  )
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(4000)
  cloudbedsUrl?: string;
}
