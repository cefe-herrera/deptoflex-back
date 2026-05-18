import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CloudbedsService } from './cloudbeds.service';
import { ReservationIntentsService } from './reservation-intents.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';
import { CreateReservationIntentDto } from './dto/create-reservation-intent.dto';

@ApiTags('Booking (Cloudbeds)')
@ApiBearerAuth('access-token')
@UseGuards(ThrottlerGuard)
@Controller()
export class CloudbedsController {
  constructor(
    private readonly cloudbeds: CloudbedsService,
    private readonly intents: ReservationIntentsService,
  ) {}

  @Public()
  @Throttle({ booking: { limit: 30, ttl: 60_000 } })
  @Post('booking/search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Buscar disponibilidad y tarifas en Cloudbeds (público)',
    description:
      'Consulta el booking engine público de Cloudbeds para una propiedad local mapeada y devuelve habitaciones disponibles con tarifas, fotos, amenities, comparación con OTAs (si está disponible) y mapeo a unidades locales. Cachea resultados 5-15 min y persiste un snapshot de auditoría. Solo lectura: para concretar la reserva se debe usar `POST /reservation-intents` y redirigir al motor oficial. Rate-limited a 30 req/min.',
  })
  searchAvailability(@Body() dto: SearchAvailabilityDto) {
    return this.cloudbeds.searchAvailability(dto);
  }

  @Public()
  @Throttle({ booking: { limit: 10, ttl: 60_000 } })
  @Post('reservation-intents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear intención de reserva y obtener URL de redirección oficial',
    description:
      'Re-consulta disponibilidad en Cloudbeds para reducir riesgo de precio/disponibilidad desactualizada, persiste una `ReservationIntent` con status PENDING y devuelve la URL del motor oficial de Cloudbeds donde el usuario debe finalizar la reserva. **Nuestro sistema nunca confirma reservas.** Las intents quedan EXPIRED automáticamente si no se usan dentro de la ventana configurada.',
  })
  createReservationIntent(
    @Body() dto: CreateReservationIntentDto,
    @Req() req: Request,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.intents.create(dto, {
      userId: user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Get('reservation-intents/:id')
  @ApiOperation({
    summary: 'Obtener una reservation intent',
    description: 'Devuelve el detalle de una intent (estado, redirectUrl, expiración). Útil para reanudar el flujo o auditar.',
  })
  findIntent(@Param('id', ParseUUIDPipe) id: string) {
    return this.intents.findOne(id);
  }

  @Public()
  @Post('reservation-intents/:id/redirected')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Marcar intent como redireccionada',
    description: 'Endpoint de tracking: el frontend debe llamarlo cuando efectivamente abre la `redirectUrl` oficial de Cloudbeds. Cambia el status de PENDING a REDIRECTED.',
  })
  async markRedirected(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.intents.markRedirected(id);
  }
}
