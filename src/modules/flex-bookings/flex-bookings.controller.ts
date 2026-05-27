import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FlexBookingsService } from './flex-bookings.service';
import { CreateFlexBookingDto } from './dto/create-flex-booking.dto';
import { UpdateFlexBookingDto } from './dto/update-flex-booking.dto';
import { QueryFlexBookingDto } from './dto/query-flex-booking.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Flex Bookings')
@ApiBearerAuth('access-token')
@Controller('flex-bookings')
export class FlexBookingsController {
  constructor(private flexBookingsService: FlexBookingsService) {}

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Crear reserva flex',
    description: 'Registra una nueva reserva mensualizada para una propiedad flex. Valida disponibilidad automáticamente. Solo ADMIN/OPERATOR.',
  })
  create(@Body() dto: CreateFlexBookingDto) {
    return this.flexBookingsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar reservas flex',
    description: 'Devuelve reservas flex paginadas con filtros por propiedad, profesional, estado y rango de fechas.',
  })
  findAll(@Query() query: QueryFlexBookingDto) {
    return this.flexBookingsService.findAll(query);
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
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlexBookingDto) {
    return this.flexBookingsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancelar reserva flex (soft delete)',
    description: 'Marca la reserva como CANCELLED y la elimina lógicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.flexBookingsService.softDelete(id);
  }
}
