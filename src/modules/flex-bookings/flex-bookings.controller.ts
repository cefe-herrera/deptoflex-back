import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FlexBookingsService } from './flex-bookings.service';
import { CreateFlexBookingDto } from './dto/create-flex-booking.dto';
import { UpdateFlexBookingDto } from './dto/update-flex-booking.dto';
import { QueryFlexBookingDto } from './dto/query-flex-booking.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Flex Bookings')
@ApiBearerAuth('access-token')
@Controller('flex-bookings')
export class FlexBookingsController {
  constructor(private flexBookingsService: FlexBookingsService) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
  @ApiOperation({
    summary: 'Crear reserva flex',
    description:
      'Registra una solicitud de reserva mensualizada. ADMIN/OPERATOR pueden asignar cualquier embajador; AMBASSADOR crea con su propio perfil profesional.',
  })
  create(@Body() dto: CreateFlexBookingDto, @CurrentUser() user: CurrentUserPayload) {
    return this.flexBookingsService.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar reservas flex',
    description: 'Devuelve reservas flex paginadas con filtros por propiedad, profesional, estado y rango de fechas.',
  })
  findAll(@Query() query: QueryFlexBookingDto) {
    return this.flexBookingsService.findAll(query);
  }

  @Get(':id/payment-link')
  @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
  @ApiOperation({
    summary: 'Obtener link de pago para el huésped',
    description: 'Devuelve la URL pública que el embajador comparte con el huésped para pagar y confirmar la reserva.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  getPaymentLink(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.flexBookingsService.getPaymentLink(id, user);
  }

  @Post(':id/resend-payment-email')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
  @ApiOperation({
    summary: 'Reenviar email de pago al huésped',
    description: 'Envía nuevamente el link de pago Mercado Pago al email del huésped.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  resendPaymentEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.flexBookingsService.resendPaymentEmail(id, user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener reserva flex por ID',
    description: 'Devuelve el detalle de una reserva flex con la propiedad flex asociada.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flexBookingsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Actualizar reserva flex',
    description: 'Permite cambiar el estado o notas de una reserva flex. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlexBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.flexBookingsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancelar reserva flex (soft delete)',
    description: 'Marca la reserva como CANCELLED y la elimina lógicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.flexBookingsService.softDelete(id, user.id);
  }
}
