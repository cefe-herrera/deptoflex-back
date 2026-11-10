import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuth } from './api-key-auth.decorator';
import { PartnerApiService } from './partner-api.service';
import { PartnerBookingsService } from './partner-bookings.service';
import { PartnerAvailabilityQueryDto } from './dto/partner-availability-query.dto';
import {
  CancelPartnerBookingDto,
  CreatePartnerBookingDto,
  ListPartnerBookingsQueryDto,
} from './dto/partner-booking.dto';
import type { ApiClientContext, PartnerRequest } from './partner-api.types';

/** El ApiKeyGuard ya validó la key: el cliente siempre está presente. */
const clientOf = (req: PartnerRequest): ApiClientContext => req.apiClient!;

@ApiTags('Partner API')
@ApiKeyAuth()
@Controller('partner')
export class PartnerApiController {
  constructor(
    private readonly partner: PartnerApiService,
    private readonly bookings: PartnerBookingsService,
  ) {}

  @Get('properties')
  @ApiOperation({
    summary: 'Listar propiedades temporales disponibles para consulta',
    description:
      'Devuelve las propiedades activas cuya disponibilidad se puede consultar por API.',
  })
  listProperties() {
    return this.partner.listProperties();
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Consultar disponibilidad y tarifas',
    description:
      'Disponibilidad y tarifas por tipo de habitación para un rango de fechas. Las respuestas pueden venir de caché (5-15 min). Si el proveedor no responde se sirven los últimos datos conocidos con `stale: true`.',
  })
  availability(
    @Query() query: PartnerAvailabilityQueryDto,
    @Req() req: PartnerRequest,
  ) {
    req.apiUsage = {};
    return this.partner.availability(
      query,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.apiUsage,
    );
  }

  // ─── Reservas ───────────────────────────────────────────────────────────────

  @Post('bookings')
  @ApiOperation({
    summary: 'Solicitar una reserva',
    description:
      'Registra la solicitud de reserva con los datos del huésped, el precio final y tu comisión. Se verifica que la habitación siga disponible. Queda en estado `PENDING` hasta que Weflex la confirma (`CONFIRMED`, con `confirmationCode`) o la rechaza (`REJECTED`). Consultá el estado con `GET /partner/bookings/{id}`. Enviando `externalReference` la operación es idempotente.',
  })
  createBooking(
    @Body() dto: CreatePartnerBookingDto,
    @Req() req: PartnerRequest,
  ) {
    req.apiUsage = {};
    return this.bookings.create(
      clientOf(req),
      dto,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.apiUsage,
    );
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Listar tus solicitudes de reserva' })
  listBookings(
    @Query() query: ListPartnerBookingsQueryDto,
    @Req() req: PartnerRequest,
  ) {
    return this.bookings.listForClient(clientOf(req).clientId, query);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Estado de una solicitud de reserva' })
  getBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: PartnerRequest,
  ) {
    return this.bookings.getForClient(clientOf(req).clientId, id);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar la cancelación de una reserva',
    description:
      'Si la reserva todavía está `PENDING` se cancela en el momento (`CANCELLED`). Si ya está `CONFIRMED` pasa a `CANCELLATION_REQUESTED` hasta que Weflex la cancela (`CANCELLED`).',
  })
  cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPartnerBookingDto,
    @Req() req: PartnerRequest,
  ) {
    return this.bookings.requestCancellation(
      clientOf(req).clientId,
      id,
      dto.reason,
    );
  }
}
