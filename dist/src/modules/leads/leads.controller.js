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
exports.LeadsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const leads_service_1 = require("./leads.service");
const create_lead_dto_1 = require("./dto/create-lead.dto");
const update_lead_dto_1 = require("./dto/update-lead.dto");
const convert_to_booking_dto_1 = require("./dto/convert-to-booking.dto");
const add_note_dto_1 = require("./dto/add-note.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const prisma_service_1 = require("../prisma/prisma.service");
const swagger_1 = require("@nestjs/swagger");
let LeadsController = class LeadsController {
    leadsService;
    prisma;
    constructor(leadsService, prisma) {
        this.leadsService = leadsService;
        this.prisma = prisma;
    }
    async create(dto, user) {
        const profile = await this.prisma.professionalProfile.findUnique({ where: { userId: user.id } });
        return this.leadsService.create(dto, profile?.id);
    }
    findAll(page = 1, limit = 20, user) {
        return this.leadsService.findAll(+page, +limit, user.id, user.roles);
    }
    findOne(id) {
        return this.leadsService.findOne(id);
    }
    update(id, dto) {
        return this.leadsService.update(id, dto);
    }
    remove(id) {
        return this.leadsService.softDelete(id);
    }
    addNote(id, dto, user) {
        return this.leadsService.addNote(id, dto, user.id);
    }
    convertToBooking(id, dto, user) {
        return this.leadsService.convertToBooking(id, dto, user.id);
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR', 'PROFESSIONAL', 'AMBASSADOR'),
    (0, swagger_1.ApiOperation)({
        summary: 'Crear un lead',
        description: 'Registra un nuevo lead (prospecto interesado). Si el usuario actual tiene perfil profesional, queda asociado automáticamente como referente.',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lead_dto_1.CreateLeadDto, Object]),
    __metadata("design:returntype", Promise)
], LeadsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar leads',
        description: 'Devuelve los leads paginados. ADMIN/OPERATOR ven todos; profesionales y embajadores ven solo los propios.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Obtener un lead por ID',
        description: 'Devuelve el detalle completo del lead, incluyendo notas y conversiones a booking.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizar un lead',
        description: 'Modifica datos del lead (estado, contacto, observaciones, etc.).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_lead_dto_1.UpdateLeadDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Eliminar un lead (soft delete)',
        description: 'Marca el lead como eliminado sin borrarlo físicamente. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.NO_CONTENT }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, swagger_1.ApiOperation)({
        summary: 'Agregar una nota al lead',
        description: 'Agrega una nota interna al lead, registrando el autor (usuario actual). Útil para tracking de seguimiento.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_note_dto_1.AddNoteDto, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "addNote", null);
__decorate([
    (0, common_1.Post)(':id/convert-to-booking'),
    (0, swagger_1.ApiOperation)({
        summary: 'Convertir lead a reserva',
        description: 'Crea una reserva a partir del lead y dispara el cálculo de comisiones para el referente. El lead queda marcado como convertido.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, convert_to_booking_dto_1.ConvertToBookingDto, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "convertToBooking", null);
exports.LeadsController = LeadsController = __decorate([
    (0, swagger_1.ApiTags)('Leads'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('leads'),
    __metadata("design:paramtypes", [leads_service_1.LeadsService,
        prisma_service_1.PrismaService])
], LeadsController);
//# sourceMappingURL=leads.controller.js.map