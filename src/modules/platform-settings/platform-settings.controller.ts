import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdateBookingPolicyDto } from './dto/update-booking-policy.dto';

@ApiTags('Platform settings')
@ApiBearerAuth('access-token')
@Controller()
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('admin/settings/booking-policy')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Política de reservas',
    description:
      'Devuelve si solo los embajadores aprobados pueden iniciar reservas, y si el valor viene del env (BOOKINGS_REQUIRE_APPROVED_AMBASSADOR) o fue sobreescrito por un admin.',
  })
  getBookingPolicy() {
    return this.settings.getBookingPolicy();
  }

  @Patch('admin/settings/booking-policy')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar política de reservas',
    description:
      'Sobreescribe el default del env. Enviar `requireApprovedAmbassador: null` vuelve al valor del env.',
  })
  updateBookingPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateBookingPolicyDto,
  ) {
    return this.settings.setBookingPolicy(
      dto.requireApprovedAmbassador,
      user.id,
    );
  }

  @Get('settings/booking-access')
  @ApiOperation({
    summary: 'Acceso a reservas del usuario autenticado',
    description:
      'Indica si el usuario actual puede iniciar reservas según la política vigente.',
  })
  getBookingAccess(@CurrentUser() user: CurrentUserPayload) {
    return this.settings.getBookingAccess(user);
  }
}
