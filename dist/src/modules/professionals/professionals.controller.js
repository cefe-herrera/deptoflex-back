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
exports.ProfessionalsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const professionals_service_1 = require("./professionals.service");
const update_professional_dto_1 = require("./dto/update-professional.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const media_service_1 = require("../media/media.service");
const presign_upload_dto_1 = require("../media/dto/presign-upload.dto");
const confirm_upload_dto_1 = require("../media/dto/confirm-upload.dto");
const swagger_1 = require("@nestjs/swagger");
let ProfessionalsController = class ProfessionalsController {
    professionalsService;
    mediaService;
    constructor(professionalsService, mediaService) {
        this.professionalsService = professionalsService;
        this.mediaService = mediaService;
    }
    getMe(user) {
        return this.professionalsService.findByUserId(user.id);
    }
    updateMe(user, dto) {
        return this.professionalsService.update(user.id, dto);
    }
    findAll(page = 1, limit = 20) {
        return this.professionalsService.findAll(+page, +limit);
    }
    findOne(id) {
        return this.professionalsService.findOne(id);
    }
    adminUpdate(id, dto) {
        return this.professionalsService.adminUpdate(id, dto);
    }
    requestAmbassador(user) {
        return this.professionalsService.requestAmbassador(user.id);
    }
    presignMyAvatar(user, dto) {
        return this.professionalsService.getProfileIdByUserId(user.id).then((profileId) => this.mediaService.presignForProfessional(profileId, dto, user.id));
    }
    confirmMyAvatar(user, dto) {
        return this.professionalsService.getProfileIdByUserId(user.id).then((profileId) => this.mediaService.confirmAvatarForProfessional(profileId, dto));
    }
    presignAvatar(id, user, dto) {
        return this.mediaService.presignForProfessional(id, dto, user.id);
    }
    confirmAvatar(id, dto) {
        return this.mediaService.confirmAvatarForProfessional(id, dto);
    }
    verify(id) {
        return this.professionalsService.verify(id);
    }
    reject(id) {
        return this.professionalsService.reject(id);
    }
    suspend(id) {
        return this.professionalsService.suspend(id);
    }
};
exports.ProfessionalsController = ProfessionalsController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener mi perfil profesional',
        description: 'Devuelve el perfil profesional asociado al usuario autenticado (datos, estado de verificación, comisiones, etc.).',
    }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizar mi perfil profesional',
        description: 'Permite al profesional editar sus propios datos (bio, contacto, especialidades, etc.).',
    }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_professional_dto_1.UpdateProfessionalDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar profesionales',
        description: 'Devuelve los perfiles profesionales paginados. Solo ADMIN/OPERATOR.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener un profesional por ID',
        description: 'Devuelve el detalle de un perfil profesional. Solo ADMIN/OPERATOR.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizar profesional (admin)',
        description: 'Permite a un ADMIN modificar campos sensibles del perfil profesional (estado, comisiones, etc.).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_professional_dto_1.AdminUpdateProfessionalDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "adminUpdate", null);
__decorate([
    (0, common_1.Post)('me/request-ambassador'),
    (0, swagger_1.ApiOperation)({
        summary: 'Solicitar rol de embajador',
        description: 'El profesional solicita ser promovido a embajador. Queda pendiente de aprobación por un ADMIN.',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "requestAmbassador", null);
__decorate([
    (0, common_1.Post)('me/avatar/presign'),
    (0, swagger_1.ApiOperation)({
        summary: 'Presign de subida de mi avatar',
        description: 'Genera una URL prefirmada (S3) para que el frontend suba directamente el avatar del profesional autenticado.',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, presign_upload_dto_1.PresignUploadDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "presignMyAvatar", null);
__decorate([
    (0, common_1.Post)('me/avatar/confirm'),
    (0, swagger_1.ApiOperation)({
        summary: 'Confirmar subida de mi avatar',
        description: 'Confirma que el avatar fue subido a S3 y lo asocia al perfil profesional del usuario autenticado.',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, confirm_upload_dto_1.ConfirmUploadDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "confirmMyAvatar", null);
__decorate([
    (0, common_1.Post)(':id/avatar/presign'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, swagger_1.ApiOperation)({
        summary: 'Presign de avatar de un profesional (admin)',
        description: 'Genera una URL prefirmada para subir el avatar de cualquier profesional. Solo ADMIN/OPERATOR.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, presign_upload_dto_1.PresignUploadDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "presignAvatar", null);
__decorate([
    (0, common_1.Post)(':id/avatar/confirm'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, swagger_1.ApiOperation)({
        summary: 'Confirmar avatar de un profesional (admin)',
        description: 'Confirma la subida del avatar y lo asocia al perfil indicado. Solo ADMIN/OPERATOR.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, confirm_upload_dto_1.ConfirmUploadDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "confirmAvatar", null);
__decorate([
    (0, common_1.Post)(':id/verify'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Verificar profesional',
        description: 'Marca al profesional como verificado, habilitándolo para operar. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Rechazar profesional',
        description: 'Rechaza la solicitud de verificación del profesional. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/suspend'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Suspender profesional',
        description: 'Suspende al profesional impidiéndole operar hasta nueva orden. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "suspend", null);
exports.ProfessionalsController = ProfessionalsController = __decorate([
    (0, swagger_1.ApiTags)('Professionals'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('professionals'),
    __metadata("design:paramtypes", [professionals_service_1.ProfessionalsService,
        media_service_1.MediaService])
], ProfessionalsController);
//# sourceMappingURL=professionals.controller.js.map