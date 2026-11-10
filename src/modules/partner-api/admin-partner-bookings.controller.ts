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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { PartnerBookingsService } from './partner-bookings.service';
import {
  AdminListPartnerBookingsQueryDto,
  ConfirmPartnerBookingDto,
  ConfirmPartnerCancellationDto,
  RejectPartnerBookingDto,
} from './dto/partner-booking.dto';

@ApiTags('Admin - Partner API')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin/api-bookings')
export class AdminPartnerBookingsController {
  constructor(private readonly bookings: PartnerBookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Solicitudes de reserva de partners (con conteo por estado)',
  })
  list(@Query() query: AdminListPartnerBookingsQueryDto) {
    return this.bookings.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una solicitud de reserva' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.adminGet(id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar: la reserva ya se creó en Cloudbeds',
  })
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPartnerBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.bookings.confirm(
      id,
      dto.cloudbedsReservationId,
      dto.adminNotes,
      user.id,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rechazar la solicitud' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPartnerBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.bookings.reject(id, dto.reason, user.id);
  }

  @Post(':id/confirm-cancellation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar cancelación: la reserva ya se canceló en Cloudbeds',
  })
  confirmCancellation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPartnerCancellationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.bookings.confirmCancellation(id, dto.adminNotes, user.id);
  }
}
