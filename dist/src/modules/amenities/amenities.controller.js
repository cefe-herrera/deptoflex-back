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
exports.AmenitiesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const amenities_service_1 = require("./amenities.service");
const create_amenity_dto_1 = require("./dto/create-amenity.dto");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let AmenitiesController = class AmenitiesController {
    amenitiesService;
    constructor(amenitiesService) {
        this.amenitiesService = amenitiesService;
    }
    findAll() {
        return this.amenitiesService.findAll();
    }
    create(dto) {
        return this.amenitiesService.create(dto);
    }
    update(id, dto) {
        return this.amenitiesService.update(id, dto);
    }
    remove(id) {
        return this.amenitiesService.remove(id);
    }
};
exports.AmenitiesController = AmenitiesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listar todas las amenities',
        description: 'Devuelve el catálogo completo de amenities disponibles para asociar a propiedades y unidades (ej: pileta, wifi, cochera).',
    }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AmenitiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Crear una amenity',
        description: 'Agrega una nueva amenity al catálogo. Solo ADMIN.',
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_amenity_dto_1.CreateAmenityDto]),
    __metadata("design:returntype", void 0)
], AmenitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizar una amenity',
        description: 'Modifica los datos de una amenity existente. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AmenitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({
        summary: 'Eliminar una amenity',
        description: 'Elimina una amenity del catálogo. Solo ADMIN.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', type: String, format: 'uuid' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.NO_CONTENT }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AmenitiesController.prototype, "remove", null);
exports.AmenitiesController = AmenitiesController = __decorate([
    (0, swagger_1.ApiTags)('Amenities'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('amenities'),
    __metadata("design:paramtypes", [amenities_service_1.AmenitiesService])
], AmenitiesController);
//# sourceMappingURL=amenities.controller.js.map