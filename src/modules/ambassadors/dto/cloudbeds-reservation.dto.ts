import {
  Equals,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Payload que envía el script personalizado inyectado en Cloudbeds cuando se
 * dispara el evento `reservation-created`.
 *
 * IMPORTANTE: este endpoint es PÚBLICO y el payload es SPOOFABLE (no hay secreto
 * en el JavaScript público de Cloudbeds). Por eso la reserva se registra como
 * PENDING y la comisión como PENDING_VALIDATION: queda pendiente de validación /
 * conciliación manual. No se confía en estos datos como verdad final.
 */
export class CloudbedsReservationDto {
  @ApiPropertyOptional({ description: 'Origen del aviso. Esperado: "cloudbeds-booking-engine".' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({
    description: 'Tipo de evento. Solo se procesa "reservation-created".',
    example: 'reservation-created',
  })
  @Equals('reservation-created', {
    message: 'event must be "reservation-created"',
  })
  event: string;

  @ApiProperty({
    description: 'Id del embajador = professionalProfileId (UUID), leído del parámetro ambassador_id de la URL.',
    format: 'uuid',
  })
  @IsUUID()
  ambassadorId: string;

  @ApiProperty({
    description: 'session_id (UUID) de la sesión creada antes de abrir Cloudbeds.',
    format: 'uuid',
  })
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional({
    description:
      'Token de tracking generado al crear la sesión. Requerido para sesiones nuevas con hash en DB.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  trackingToken?: string;

  @ApiPropertyOptional({
    enum: ['ambassador', 'guest'],
    description: 'Modo de navegación en Cloudbeds.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mode?: string;

  @ApiPropertyOptional({
    description: 'Id de reserva de Cloudbeds (booking_id). Si viene, se usa para dedupe e idempotencia.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bookingId?: string;

  @ApiPropertyOptional({
    description: 'Objeto de reserva completo tal cual lo entrega Cloudbeds (estructura no garantizada).',
  })
  @IsOptional()
  @IsObject()
  reservation?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Datos del huésped leídos del formulario de checkout (DOM). Cloudbeds no los incluye en reservation-created.',
  })
  @IsOptional()
  @IsObject()
  guestForm?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Metadata de la propiedad embebida en la página (JSON-LD / data-metadata) y código SYhMUF de la URL.',
  })
  @IsOptional()
  @IsObject()
  pageMetadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'URL del motor de Cloudbeds al momento de la reserva.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  cloudbedsUrl?: string;

  @ApiPropertyOptional({ description: 'Fecha ISO en que el script armó el payload.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  createdAt?: string;
}
