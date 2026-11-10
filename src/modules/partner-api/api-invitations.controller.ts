import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { ApiOrganizationService } from './api-organization.service';
import { AcceptApiInvitationDto } from './dto/api-organization.dto';

/** Endpoints públicos para ver y aceptar una invitación (link del email). */
@ApiTags('API portal (organización)')
@UseGuards(ThrottlerGuard)
@Controller('api-invitations')
export class ApiInvitationsController {
  constructor(private readonly org: ApiOrganizationService) {}

  @Public()
  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  @Get(':token')
  @ApiOperation({ summary: 'Ver datos de una invitación' })
  preview(@Param('token') token: string) {
    return this.org.preview(token);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceptar invitación',
    description:
      'Si el email no tiene cuenta, se crea con nombre/apellido/contraseña. Si ya tiene, hay que estar logueado con ese email. Devuelve tokens de sesión.',
  })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptApiInvitationDto,
    @Req() req: Request,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.org.accept(token, dto, user?.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
