import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { BookingSource } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Get()
    @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
    @ApiOperation({
        summary: 'Listar reservas unificadas',
        description:
            'ADMIN/OPERATOR ven todas las reservas del registro unificado. AMBASSADOR solo las propias. Use excludeSource=FLEX para omitir reservas flex (listadas aparte en /flex-bookings).',
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'excludeSource', required: false, enum: BookingSource })
    findAll(
        @CurrentUser() user: CurrentUserPayload,
        @Query('page') page = 1,
        @Query('limit') limit = 20,
        @Query('excludeSource') excludeSource?: BookingSource,
    ) {
        return this.bookingsService.findAll(+page, +limit, user.id, user.roles, {
            excludeSource,
        });
    }

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
