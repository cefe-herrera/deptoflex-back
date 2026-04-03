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
exports.PropertiesController = void 0;
const common_1 = require("@nestjs/common");
const properties_service_1 = require("./properties.service");
const create_property_dto_1 = require("./dto/create-property.dto");
const update_property_dto_1 = require("./dto/update-property.dto");
const query_properties_dto_1 = require("./dto/query-properties.dto");
const media_service_1 = require("../media/media.service");
const presign_upload_dto_1 = require("../media/dto/presign-upload.dto");
const confirm_upload_dto_1 = require("../media/dto/confirm-upload.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let PropertiesController = class PropertiesController {
    propertiesService;
    mediaService;
    constructor(propertiesService, mediaService) {
        this.propertiesService = propertiesService;
        this.mediaService = mediaService;
    }
    create(dto) {
        return this.propertiesService.create(dto);
    }
    findAll(query) {
        return this.propertiesService.findAll(query);
    }
    findOne(id) {
        return this.propertiesService.findOne(id);
    }
    update(id, dto) {
        return this.propertiesService.update(id, dto);
    }
    remove(id) {
        return this.propertiesService.softDelete(id);
    }
    addAmenity(id, amenityId) {
        return this.propertiesService.addAmenity(id, amenityId);
    }
    removeAmenity(id, amenityId) {
        return this.propertiesService.removeAmenity(id, amenityId);
    }
    presignImage(id, dto, user) {
        return this.mediaService.presignForProperty(id, dto, user.id);
    }
    confirmImage(id, dto) {
        return this.mediaService.confirmForProperty(id, dto);
    }
    deleteImage(id, imageId) {
        return this.mediaService.deletePropertyImage(id, imageId);
    }
};
exports.PropertiesController = PropertiesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_property_dto_1.CreatePropertyDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_properties_dto_1.QueryPropertiesDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_property_dto_1.UpdatePropertyDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/amenities'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)('amenityId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "addAmenity", null);
__decorate([
    (0, common_1.Delete)(':id/amenities/:amenityId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('amenityId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "removeAmenity", null);
__decorate([
    (0, common_1.Post)(':id/images/presign'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, presign_upload_dto_1.PresignUploadDto, Object]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "presignImage", null);
__decorate([
    (0, common_1.Post)(':id/images/confirm'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, confirm_upload_dto_1.ConfirmUploadDto]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "confirmImage", null);
__decorate([
    (0, common_1.Delete)(':id/images/:imageId'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('imageId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PropertiesController.prototype, "deleteImage", null);
exports.PropertiesController = PropertiesController = __decorate([
    (0, common_1.Controller)('properties'),
    __metadata("design:paramtypes", [properties_service_1.PropertiesService,
        media_service_1.MediaService])
], PropertiesController);
//# sourceMappingURL=properties.controller.js.map