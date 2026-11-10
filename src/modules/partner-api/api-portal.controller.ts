import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ApiClientsService } from './api-clients.service';
import {
  ApiOrganizationService,
  MANAGER_ROLES,
} from './api-organization.service';
import {
  CreateApiKeyDto,
  UsageEventsQueryDto,
  UsageRangeQueryDto,
} from './dto/api-client.dto';
import {
  ChangeApiMemberRoleDto,
  InviteApiMemberDto,
} from './dto/api-organization.dto';

/**
 * Panel de la organización cliente de la API (usuarios con membresía).
 * OWNER/ADMIN gestionan keys y usuarios; VIEWER solo ve las métricas.
 */
@ApiTags('API portal (organización)')
@ApiBearerAuth('access-token')
@Controller('api-portal')
export class ApiPortalController {
  constructor(
    private readonly org: ApiOrganizationService,
    private readonly clients: ApiClientsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Mi organización y mi rol' })
  async me(@CurrentUser() user: CurrentUserPayload) {
    const m = await this.org.requireMembership(user.id);
    return {
      organization: m.client,
      role: m.role,
      canManage: MANAGER_ROLES.includes(m.role),
    };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Métricas de consumo de la organización' })
  async usage(
    @CurrentUser() user: CurrentUserPayload,
    @Query() range: UsageRangeQueryDto,
  ) {
    const m = await this.org.requireMembership(user.id);
    return this.clients.usageSummary(range, m.client.id);
  }

  @Get('usage/events')
  @ApiOperation({ summary: 'Últimas requests de la organización' })
  async events(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: UsageEventsQueryDto,
  ) {
    const m = await this.org.requireMembership(user.id);
    return this.clients.recentEvents(m.client.id, query, query.limit);
  }

  // ─── API keys (OWNER / ADMIN) ──────────────────────────────────────────────

  @Get('keys')
  @ApiOperation({ summary: 'Listar API keys' })
  async keys(@CurrentUser() user: CurrentUserPayload) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    const client = await this.clients.get(m.client.id);
    return client.keys;
  }

  @Post('keys')
  @ApiOperation({
    summary: 'Generar API key',
    description: 'La key en claro se devuelve solo en esta respuesta.',
  })
  async createKey(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateApiKeyDto,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.clients.createKey(m.client.id, dto, user.id);
  }

  @Delete('keys/:keyId')
  @ApiOperation({ summary: 'Revocar API key' })
  async revokeKey(
    @CurrentUser() user: CurrentUserPayload,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.clients.revokeKey(m.client.id, keyId, user.id);
  }

  // ─── Usuarios (OWNER / ADMIN) ──────────────────────────────────────────────

  @Get('members')
  @ApiOperation({ summary: 'Usuarios e invitaciones pendientes' })
  async members(@CurrentUser() user: CurrentUserPayload) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.listMembers(m.client.id);
  }

  @Post('invitations')
  @ApiOperation({ summary: 'Invitar a un usuario por email' })
  async invite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteApiMemberDto,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.invite({
      clientId: m.client.id,
      email: dto.email,
      role: dto.role,
      invitedById: user.id,
    });
  }

  @Post('invitations/:invitationId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar invitación' })
  async resend(
    @CurrentUser() user: CurrentUserPayload,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.resendInvitation(m.client.id, invitationId, user.id);
  }

  @Delete('invitations/:invitationId')
  @ApiOperation({ summary: 'Cancelar invitación' })
  async revokeInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.revokeInvitation(m.client.id, invitationId, user.id);
  }

  @Patch('members/:memberId')
  @ApiOperation({ summary: 'Cambiar rol de un usuario' })
  async changeRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ChangeApiMemberRoleDto,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.changeRole(m.client.id, memberId, dto.role, user.id);
  }

  @Delete('members/:memberId')
  @ApiOperation({ summary: 'Quitar usuario de la organización' })
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    const m = await this.org.requireMembership(user.id, MANAGER_ROLES);
    return this.org.removeMember(m.client.id, memberId, user.id);
  }
}
