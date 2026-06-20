import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { AmbassadorsService } from './ambassadors.service';
import { CreateReservationSessionDto } from './dto/create-reservation-session.dto';
import { CloudbedsReservationDto } from './dto/cloudbeds-reservation.dto';

@ApiTags('Ambassadors (Cloudbeds tracking)')
@UseGuards(ThrottlerGuard)
@Controller('ambassadors')
export class AmbassadorsController {
  constructor(private readonly ambassadors: AmbassadorsService) {}

  /**
   * Crea la sesión de reserva del embajador ANTES de abrir el motor de Cloudbeds.
   * Requiere autenticación: el dueño se resuelve desde el usuario autenticado.
   */
  @Post('reservation-sessions')
  @ApiBearerAuth('access-token')
  @Roles('AMBASSADOR', 'OPERATOR', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear sesión de reserva de embajador (autenticado)',
    description:
      'Persiste una sesión liviana (session_id + cloudbedsUrl) asociada al embajador autenticado, antes de redirigir/abrir el motor público de Cloudbeds. NO usa la API oficial de Cloudbeds.',
  })
  createSession(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReservationSessionDto,
  ) {
    return this.ambassadors.createSession(user.id, dto);
  }

  /**
   * Endpoint PÚBLICO que recibe el aviso `reservation-created` desde el script
   * inyectado en Cloudbeds. Spoofable: registra Booking PENDING + Commission
   * PENDING_VALIDATION. Idempotente: siempre responde 200, incluso ante duplicados.
   */
  @Public()
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @Post('cloudbeds-reservation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recibir reserva creada en Cloudbeds (público, sin API oficial)',
    description:
      'Recibe el payload del evento reservation-created enviado por el script personalizado de Cloudbeds (postMessage + fetch). Valida event/sessionId/ambassadorId, busca la sesión, asocia la reserva al embajador, crea Booking PENDING y Commission PENDING_VALIDATION, y deduplica por bookingId/sessionId. Responde 200 incluso si ya fue procesado.',
  })
  receiveReservation(@Body() dto: CloudbedsReservationDto) {
    return this.ambassadors.handleCloudbedsReservation(dto);
  }
}
