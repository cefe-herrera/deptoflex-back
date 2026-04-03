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
const common_1 = require("@nestjs/common");
const professionals_service_1 = require("./professionals.service");
const update_professional_dto_1 = require("./dto/update-professional.dto");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let ProfessionalsController = class ProfessionalsController {
    professionalsService;
    constructor(professionalsService) {
        this.professionalsService = professionalsService;
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
    verify(id) {
        return this.professionalsService.verify(id);
    }
    suspend(id) {
        return this.professionalsService.suspend(id);
    }
};
exports.ProfessionalsController = ProfessionalsController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "getMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_professional_dto_1.UpdateProfessionalDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'OPERATOR'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_professional_dto_1.AdminUpdateProfessionalDto]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "adminUpdate", null);
__decorate([
    (0, common_1.Post)(':id/verify'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)(':id/suspend'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfessionalsController.prototype, "suspend", null);
exports.ProfessionalsController = ProfessionalsController = __decorate([
    (0, common_1.Controller)('professionals'),
    __metadata("design:paramtypes", [professionals_service_1.ProfessionalsService])
], ProfessionalsController);
//# sourceMappingURL=professionals.controller.js.map