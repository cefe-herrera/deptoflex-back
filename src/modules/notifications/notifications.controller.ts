import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { TestNotificationDto } from './dto/test-notification.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { AdminListNotificationsQueryDto } from './dto/admin-list-notifications.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones del usuario autenticado',
    description:
      'Devuelve las notificaciones persistidas del usuario, ordenadas por fecha (más recientes primero). Soporta paginación y un filtro opcional para mostrar solo las no leídas.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items por página (default: 20)' })
  @ApiQuery({ name: 'unread', required: false, type: String, description: 'Si es "true", solo devuelve no leídas' })
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.list(user.id, +page, +limit, unread === 'true');
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Cantidad de notificaciones no leídas',
    description: 'Devuelve `{ count }` con la cantidad de notificaciones del usuario que aún no fueron marcadas como leídas. Útil para badges en la UI.',
  })
  unreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.notifications.unreadCount(user.id).then((count) => ({ count }));
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Preferencias de notificaciones del usuario',
    description: 'Devuelve push, email, promociones y WhatsApp (este último reservado).',
  })
  getPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({
    summary: 'Actualizar preferencias de notificaciones',
    description: 'Persiste las preferencias del usuario. WhatsApp aún no está habilitado.',
  })
  updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Get('admin/list')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Historial de notificaciones (admin)',
    description: 'Lista todas las notificaciones enviadas, con datos del destinatario. Paginado.',
  })
  adminList(@Query() query: AdminListNotificationsQueryDto) {
    return this.notifications.listAdmin(
      query.page ?? 1,
      query.limit ?? 50,
      query.type,
      query.userId,
    );
  }

  @Post('send')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar notificación (admin)',
    description:
      'Despliega una notificación a un usuario, a todos los de un rol, o a todos los usuarios activos. Persiste en DB, emite por WebSocket y envía push.',
  })
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.broadcast(dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Enviar notificación de prueba',
    description:
      'Dispara una notificación real (DB + WebSocket + push) al usuario autenticado. ADMIN puede enviar a otro userId. Útil para validar el flujo E2E.',
  })
  sendTest(@CurrentUser() user: CurrentUserPayload, @Body() dto: TestNotificationDto) {
    const targetUserId = dto.userId ?? user.id;
    const isAdmin = user.roles?.includes('ADMIN');

    if (dto.userId && dto.userId !== user.id && !isAdmin) {
      throw new ForbiddenException('Only ADMIN can send test notifications to other users');
    }

    return this.notifications.sendToUser({
      userId: targetUserId,
      type: dto.type ?? NotificationType.GENERIC,
      title: dto.title ?? 'Notificación de prueba',
      body: dto.body ?? 'Si ves esto, el sistema de notificaciones funciona correctamente.',
      data: {
        url: '/dashboard/notifications',
        ...dto.data,
      },
    });
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Marcar una notificación como leída',
    description: 'Marca la notificación indicada como leída (set `readAt`). El usuario solo puede modificar sus propias notificaciones; en caso contrario devuelve 404.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID de la notificación' })
  markAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar todas las notificaciones como leídas',
    description: 'Marca todas las notificaciones no leídas del usuario como leídas y emite por WebSocket `notification:unread-count` con count = 0. Devuelve `{ updated }` con la cantidad afectada.',
  })
  markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    return this.notifications.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una notificación',
    description: 'Elimina permanentemente una notificación del usuario. Devuelve 404 si no existe o no pertenece al usuario.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid', description: 'ID de la notificación' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.remove(user.id, id);
  }

  // ── Device tokens ─────────────────────────────────────────────────────────

  @Post('devices')
  @ApiOperation({
    summary: 'Registrar un device para push notifications',
    description:
      'Registra (o actualiza si ya existe) un token de device para recibir push. Para FCM enviar `token` con el registration token. Para Web Push enviar `endpoint`, `p256dh` y `authKey` además del `token` (usar `subscription.endpoint` como token). Es idempotente por (userId, token).',
  })
  registerDevice(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.id, dto);
  }

  @Get('devices')
  @ApiOperation({
    summary: 'Listar devices registrados del usuario',
    description: 'Devuelve los devices del usuario ordenados por último uso, útil para mostrar sesiones activas o debug del estado de push.',
  })
  listDevices(@CurrentUser() user: CurrentUserPayload) {
    return this.notifications.listDevices(user.id);
  }

  @Delete('devices')
  @ApiOperation({
    summary: 'Eliminar un device registrado',
    description: 'Da de baja el device asociado al token enviado en el body (ej: al cerrar sesión o deshabilitar push en el cliente).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: { token: { type: 'string', description: 'Token FCM o endpoint Web Push registrado previamente' } },
    },
  })
  unregisterDevice(@CurrentUser() user: CurrentUserPayload, @Body('token') token: string) {
    return this.notifications.unregisterDevice(user.id, token);
  }
}
