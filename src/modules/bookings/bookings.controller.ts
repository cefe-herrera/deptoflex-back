import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Get(':id')
    @ApiOperation({
        summary: 'Obtener una reserva por ID',
        description: 'Devuelve el detalle completo de una reserva (booking), incluyendo unidad, fechas, estado y huésped asociado.',
    })
    @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID de la reserva' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.bookingsService.findOne(id);
    }
}
