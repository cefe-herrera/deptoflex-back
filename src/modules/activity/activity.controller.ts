import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@Controller('me/activity')
export class ActivityController {
  constructor(private activity: ActivityService) {}

  @Get('earnings')
  @ApiOperation({
    summary: 'Resumen de ganancias del usuario',
    description:
      'Devuelve totales, contadores por tipo (Flex/Temporario), monto a cobrar y últimos movimientos de comisión del perfil profesional del usuario autenticado.',
  })
  earnings(@CurrentUser() user: CurrentUserPayload) {
    return this.activity.getEarnings(user.id);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'Historial de reservas del usuario',
    description:
      'Lista paginada de bookings asociados al perfil profesional del usuario, con comisión, propiedad e imagen. Soporta búsqueda y filtros.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['FLEX', 'TEMPORARIO'] })
  @ApiQuery({ name: 'state', required: false, enum: ['Activo', 'Finalizado', 'Cancelado'] })
  bookings(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('type') type?: 'FLEX' | 'TEMPORARIO',
    @Query('state') state?: 'Activo' | 'Finalizado' | 'Cancelado',
  ) {
    return this.activity.getBookings(user.id, +page, +limit, search, type, state);
  }

  @Get('bookings/:id')
  @ApiOperation({
    summary: 'Detalle de una reserva del usuario',
    description:
      'Devuelve el detalle completo de un booking del perfil profesional autenticado, incluyendo comisión e historial de estados.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  bookingDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.activity.getBookingDetail(user.id, id);
  }
}
