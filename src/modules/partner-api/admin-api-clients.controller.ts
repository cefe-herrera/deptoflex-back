import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ApiClientsService } from './api-clients.service';
import {
  CreateApiClientDto,
  UpdateApiClientDto,
  UsageEventsQueryDto,
  UsageRangeQueryDto,
} from './dto/api-client.dto';

@ApiTags('Admin - Partner API')
@ApiBearerAuth('access-token')
@Roles('ADMIN')
@Controller('admin')
export class AdminApiClientsController {
  constructor(private readonly clients: ApiClientsService) {}

  @Get('api-usage')
  @ApiOperation({
    summary: 'Métricas globales de uso de la Partner API (todos los clientes)',
  })
  globalUsage(@Query() range: UsageRangeQueryDto) {
    return this.clients.usageSummary(range);
  }

  @Get('api-clients')
  @ApiOperation({ summary: 'Listar clientes de la Partner API' })
  list() {
    return this.clients.list();
  }

  @Post('api-clients')
  @ApiOperation({ summary: 'Crear cliente de la Partner API' })
  create(
    @Body() dto: CreateApiClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clients.create(dto, user.id);
  }

  @Get('api-clients/:id')
  @ApiOperation({ summary: 'Detalle de un cliente con sus keys' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(id);
  }

  @Patch('api-clients/:id')
  @ApiOperation({
    summary: 'Actualizar cliente (nombre, límite, suspender/reactivar)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clients.update(id, dto, user.id);
  }

  @Delete('api-clients/:id')
  @ApiOperation({ summary: 'Eliminar cliente (revoca todas sus keys)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clients.remove(id, user.id);
  }

  @Post('api-clients/:id/owner-invitation')
  @ApiOperation({
    summary: 'Reenviar invitación a la cuenta principal',
    description:
      'Genera una invitación nueva al email de contacto (cancela la anterior pendiente).',
  })
  resendOwnerInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clients.resendOwnerInvitation(id, user.id);
  }

  @Delete('api-clients/:id/keys/:keyId')
  @ApiOperation({ summary: 'Revocar API key' })
  revokeKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clients.revokeKey(id, keyId, user.id);
  }

  @Get('api-clients/:id/usage')
  @ApiOperation({ summary: 'Métricas de uso de un cliente' })
  usage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() range: UsageRangeQueryDto,
  ) {
    return this.clients.usageSummary(range, id);
  }

  @Get('api-clients/:id/usage/events')
  @ApiOperation({ summary: 'Últimas requests de un cliente (log crudo)' })
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UsageEventsQueryDto,
  ) {
    return this.clients.recentEvents(id, query, query.limit);
  }
}
