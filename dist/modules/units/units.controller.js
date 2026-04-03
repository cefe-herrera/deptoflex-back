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
exports.UnitsController = void 0;
const common_1 = require("@nestjs/common");
const units_service_1 = require("./units.service");
const create_unit_dto_1 = require("./dto/create-unit.dto");
const update_unit_dto_1 = require("./dto/update-unit.dto");
const set_availability_dto_1 = require("./dto/set-availability.dto");
const set_pricing_rules_dto_1 = require("./dto/set-pricing-rules.dto");
const media_service_1 = require("../media/media.service");
const presign_upload_dto_1 = require("../media/dto/presign-upload.dto");
const confirm_upload_dto_1 = require("../media/dto/confirm-upload.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
let UnitsController = class UnitsController {
    unitsService;
    mediaService;
    constructor(unitsService, mediaService) {
        this.unitsService = unitsService;
        this.mediaService = mediaService;
    }
    create(dto) {
        return this.unitsService.create(dto);
    }
    findAll(page = 1, limit = 20, propertyId, status) {
        return this.unitsService.findAll(+page, +limit, propertyId, status);
    }
    findOne(id) {
        return this.unitsService.findOne(id);
    }
    update(id, dto) {
        return this.unitsService.update(id, dto);
    }
    remove(id) {
        return this.unitsService.softDelete(id);
    }
    getAvailability(id, from, to) {
        return this.unitsService.getAvailability(id, from, to);
    }
    setAvailability(id, dto) {
        return this.unitsService.setAvailability(id, dto);
    }
    getRates(id) {
        return this.unitsService.getRates(id);
    }
    setRates(id, dto) {
        return this.unitsService.setRates(id, dto);
    }
    addAmenity(id, amenityId) {
        return this.unitsService.addAmenity(id, amenityId);
    }
    removeAmenity(id, amenityId) {
        return this.unitsService.removeAmenity(id, amenityId);
    }
    presignImage(id, dto, user) {
        return this.mediaService.presignForUnit(id, dto, user.id);
    }
    confirmImage(id, dto) {
        return this.mediaService.confirmForUnit(id, dto);
    }
    deleteImage(id, imageId) {
        return this.mediaService.deleteUnitImage(id, imageId);
    }
};
exports.UnitsController = UnitsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_unit_dto_1.CreateUnitDto]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('propertyId')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_unit_dto_1.UpdateUnitDto]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/availability'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Post)(':id/availability'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_availability_dto_1.SetAvailabilityDto]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "setAvailability", null);
__decorate([
    (0, common_1.Get)(':id/rates'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "getRates", null);
__decorate([
    (0, common_1.Put)(':id/rates'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_pricing_rules_dto_1.SetPricingRulesDto]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "setRates", null);
__decorate([
    (0, common_1.Post)(':id/amenities'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('amenityId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "addAmenity", null);
__decorate([
    (0, common_1.Delete)(':id/amenities/:amenityId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('amenityId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "removeAmenity", null);
__decorate([
    (0, common_1.Post)(':id/images/presign'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, presign_upload_dto_1.PresignUploadDto, Object]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "presignImage", null);
__decorate([
    (0, common_1.Post)(':id/images/confirm'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, confirm_upload_dto_1.ConfirmUploadDto]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "confirmImage", null);
__decorate([
    (0, common_1.Delete)(':id/images/:imageId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('imageId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UnitsController.prototype, "deleteImage", null);
exports.UnitsController = UnitsController = __decorate([
    (0, common_1.Controller)('units'),
    __metadata("design:paramtypes", [units_service_1.UnitsService,
        media_service_1.MediaService])
], UnitsController);
//# sourceMappingURL=units.controller.js.map