import {
    Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { BookingSource, CancellationRequestStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { BookingCancellationRequestsService } from './booking-cancellation-requests.service';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { RequestCancellationDto } from './dto/request-cancellation.dto';
import { RejectCancellationDto } from './dto/reject-cancellation.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Bookings')
@ApiBearerAuth('access-token')
@Controller('bookings')
export class BookingsController {
    constructor(
        private readonly bookingsService: BookingsService,
        private readonly cancellationRequests: BookingCancellationRequestsService,
    ) { }

    @Get('cancellation-requests')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Listar solicitudes de cancelación',
        description: 'Cola de solicitudes de cancelación enviadas por embajadores.',
    })
    @ApiQuery({ name: 'status', required: false, enum: CancellationRequestStatus })
    listCancellationRequests(@Query('status') status?: CancellationRequestStatus) {
        return this.cancellationRequests.listRequests(status ?? CancellationRequestStatus.PENDING);
    }

    @Post('cancellation-requests/:requestId/approve')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Aprobar solicitud de cancelación',
        description: 'Ejecuta la cancelación de la reserva y notifica al embajador y al cliente.',
    })
    approveCancellationRequest(
        @Param('requestId', ParseUUIDPipe) requestId: string,
        @CurrentUser() user: CurrentUserPayload,
    ) {
        return this.cancellationRequests.approve(requestId, user.id);
    }

    @Post('cancellation-requests/:requestId/reject')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Rechazar solicitud de cancelación',
        description: 'Rechaza la solicitud; la reserva permanece activa.',
    })
    rejectCancellationRequest(
        @Param('requestId', ParseUUIDPipe) requestId: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: RejectCancellationDto,
    ) {
        return this.cancellationRequests.reject(requestId, user.id, body.adminNotes);
    }

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
    @Roles('ADMIN', 'OPERATOR', 'AMBASSADOR')
    @ApiOperation({
        summary: 'Obtener una reserva por ID',
        description: 'Devuelve el detalle completo de una reserva (booking), incluyendo unidad, fechas, estado y huésped asociado.',
    })
    @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID de la reserva' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.bookingsService.findOne(id);
    }

    @Patch(':id')
    @Roles('ADMIN', 'OPERATOR')
    @ApiOperation({
        summary: 'Editar reserva temporal',
        description: 'Actualiza datos del cliente, fechas o notas de una reserva temporal (no Flex).',
    })
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBookingDto) {
        return this.bookingsService.update(id, dto);
    }

    @Post(':id/confirm')
    @Roles('ADMIN', 'OPERATOR')
    @ApiOperation({
        summary: 'Confirmar reserva temporal',
        description: 'Pasa una reserva PENDING a CONFIRMED y registra comisión si corresponde.',
    })
    confirm(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: CancelBookingDto,
    ) {
        return this.bookingsService.confirm(id, body.reason, user.id);
    }

    @Post(':id/cancel')
    @Roles('ADMIN', 'OPERATOR')
    @ApiOperation({
        summary: 'Cancelar reserva temporal',
        description: 'Cancela una reserva temporal y anula la comisión asociada si existe.',
    })
    cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: CancelBookingDto,
    ) {
        return this.bookingsService.cancel(id, body.reason ?? 'Cancelada por administración', user.id);
    }

    @Post(':id/request-cancellation')
    @Roles('AMBASSADOR')
    @ApiOperation({
        summary: 'Solicitar cancelación de reserva',
        description: 'El embajador solicita la cancelación; un ADMIN debe aprobarla.',
    })
    requestCancellation(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: CurrentUserPayload,
        @Body() body: RequestCancellationDto,
    ) {
        return this.cancellationRequests.requestCancellation(id, user.id, body.reason);
    }
}
