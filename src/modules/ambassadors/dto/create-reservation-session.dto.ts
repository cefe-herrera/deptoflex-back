import { IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Sesión liviana que el embajador crea ANTES de abrir el motor de Cloudbeds.
 * El `sessionId` es un UUID generado en el frontend; el backend lo persiste para
 * poder asociar después la reserva (que ocurre 100% en Cloudbeds) con el embajador.
 *
 * Esta integración NO usa la API oficial de Cloudbeds.
 */
export class CreateReservationSessionDto {
  @ApiProperty({
    description: 'UUID generado en el frontend; será el id de la sesión (session_id en la URL de Cloudbeds).',
    format: 'uuid',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'URL del motor de Cloudbeds construida en el frontend (con currency, ambassador_id, session_id, utm_*).',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(4000)
  cloudbedsUrl: string;
}
