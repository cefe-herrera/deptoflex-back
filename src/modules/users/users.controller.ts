import {
  Controller, Get, Patch, Delete, Body, Param, ParseUUIDPipe, ParseIntPipe, Query,
  Post, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get('me')
  @ApiOperation({
    summary: 'Obtener mi usuario',
    description: 'Devuelve los datos del usuario autenticado (perfil completo, distinto al `/auth/me`).',
  })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Actualizar mi usuario',
    description: 'Permite al usuario autenticado modificar sus propios datos básicos.',
  })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Listar usuarios',
    description: 'Devuelve usuarios paginados. Solo ADMIN/OPERATOR.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(+page, +limit, search);
  }

  @Get('invitations/link')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Obtener link de invitación al registro',
    description: 'Devuelve el enlace de registro de Weflex. Si se indica email, valida que no exista. Solo ADMIN.',
  })
  @ApiQuery({ name: 'email', required: false, type: String })
  getInvitationLink(@Query('email') email?: string) {
    return this.usersService.getRegistrationInvitationLink(email);
  }

  @Post('invitations')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Enviar invitación por email',
    description: 'Valida que el email no esté registrado y envía invitación al registro. Solo ADMIN.',
  })
  sendInvitation(@Body() dto: SendInvitationDto) {
    return this.usersService.sendRegistrationInvitation(dto.email);
  }

  @Get(':id/role-audit')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Historial de cambios de roles',
    description: 'Devuelve la trazabilidad de asignaciones y remociones de roles del usuario. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  getRoleAudit(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getRoleAuditTrail(id);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Devuelve el detalle del usuario indicado. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Modifica datos de cualquier usuario. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar usuario (soft delete)',
    description: 'Marca al usuario como eliminado sin borrarlo físicamente. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Post(':id/roles')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Asignar rol a usuario',
    description: 'Asigna un rol al usuario indicado. Registra quién hizo la asignación. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.usersService.assignRole(id, dto.roleId, user.id, req.ip);
  }

  @Delete(':id/roles/:roleId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Quitar rol a usuario',
    description: 'Remueve un rol previamente asignado al usuario. Solo ADMIN.',
  })
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.usersService.removeRole(id, roleId, user.id, req.ip);
  }
}
