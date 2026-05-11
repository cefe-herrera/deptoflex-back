"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const notifications_service_1 = require("./notifications.service");
const register_device_dto_1 = require("./dto/register-device.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let NotificationsController = class NotificationsController {
    notifications;
    constructor(notifications) {
        this.notifications = notifications;
    }
    list(user, page = 1, limit = 20, unread) {
        return this.notifications.list(user.id, +page, +limit, unread === 'true');
    }
    unreadCount(user) {
        return this.notifications.unreadCount(user.id).then((count) => ({ count }));
    }
    markAsRead(user, id) {
        return this.notifications.markAsRead(user.id, id);
    }
    markAllAsRead(user) {
        return this.notifications.markAllAsRead(user.id);
    }
    remove(user, id) {
        return this.notifications.remove(user.id, id);
    }
    registerDevice(user, dto) {
        return this.notifications.registerDevice(user.id, dto);
    }
    listDevices(user) {
        return this.notifications.listDevices(user.id);
    }
    unregisterDevice(user, token) {
        return this.notifications.unregisterDevice(user.id, token);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar notificaciones del usuario autenticado',
        description: 'Devuelve las notificaciones persistidas del usuario, ordenadas por fecha (más recientes primero). Soporta paginación y un filtro opcional para mostrar solo las no leídas.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number, description: 'Página (default: 1)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number, description: 'Items por página (default: 20)' }),
    (0, swagger_1.ApiQuery)({ name: 'unread', required: false, type: String, description: 'Si es "true", solo devuelve no leídas' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('unread')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('unread-count'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cantidad de notificaciones no leídas',
        description: 'Devuelve `{ count }` con la cantidad de notificaciones del usuario que aún no fueron marcadas como leídas. Útil para badges en la UI.',
    }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "unreadCount", null);
__decorate([
    (0, common_1.Patch)(':id/read'),
    (0, swagger_1.ApiOperation)({
        summary: 'Marcar una notificación como leída',
        description: 'Marca la notificación indicada como leída (set `readAt`). El usuario solo puede modificar sus propias notificaciones; en caso contrario devuelve 404.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid', description: 'ID de la notificación' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markAsRead", null);
__decorate([
    (0, common_1.Patch)('read-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Marcar todas las notificaciones como leídas',
        description: 'Marca todas las notificaciones no leídas del usuario como leídas y emite por WebSocket `notification:unread-count` con count = 0. Devuelve `{ updated }` con la cantidad afectada.',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markAllAsRead", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Eliminar una notificación',
        description: 'Elimina permanentemente una notificación del usuario. Devuelve 404 si no existe o no pertenece al usuario.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid', description: 'ID de la notificación' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('devices'),
    (0, swagger_1.ApiOperation)({
        summary: 'Registrar un device para push notifications',
        description: 'Registra (o actualiza si ya existe) un token de device para recibir push. Para FCM enviar `token` con el registration token. Para Web Push enviar `endpoint`, `p256dh` y `authKey` además del `token` (usar `subscription.endpoint` como token). Es idempotente por (userId, token).',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_device_dto_1.RegisterDeviceDto]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "registerDevice", null);
__decorate([
    (0, common_1.Get)('devices'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar devices registrados del usuario',
        description: 'Devuelve los devices del usuario ordenados por último uso, útil para mostrar sesiones activas o debug del estado de push.',
    }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "listDevices", null);
__decorate([
    (0, common_1.Delete)('devices'),
    (0, swagger_1.ApiOperation)({
        summary: 'Eliminar un device registrado',
        description: 'Da de baja el device asociado al token enviado en el body (ej: al cerrar sesión o deshabilitar push en el cliente).',
    }),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            required: ['token'],
            properties: { token: { type: 'string', description: 'Token FCM o endpoint Web Push registrado previamente' } },
        },
    }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "unregisterDevice", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, swagger_1.ApiTags)('Notifications'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map