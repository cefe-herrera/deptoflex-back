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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterDeviceDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class RegisterDeviceDto {
    platform;
    provider;
    token;
    endpoint;
    p256dh;
    authKey;
    userAgent;
    static _OPENAPI_METADATA_FACTORY() {
        return { platform: { required: true, type: () => Object }, provider: { required: true, type: () => Object }, token: { required: true, type: () => String }, endpoint: { required: false, type: () => String }, p256dh: { required: false, type: () => String }, authKey: { required: false, type: () => String }, userAgent: { required: false, type: () => String, maxLength: 500 } };
    }
}
exports.RegisterDeviceDto = RegisterDeviceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.DevicePlatform, description: 'Plataforma del device', example: 'WEB' }),
    (0, class_validator_1.IsEnum)(client_1.DevicePlatform),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "platform", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.DeviceProvider, description: 'Proveedor de push', example: 'WEBPUSH' }),
    (0, class_validator_1.IsEnum)(client_1.DeviceProvider),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Para FCM: el registration token devuelto por `getToken()` en el cliente. Para Web Push: el `subscription.endpoint` (URL).',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "token", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Solo Web Push: `subscription.endpoint`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "endpoint", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Solo Web Push: `subscription.keys.p256dh`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "p256dh", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Solo Web Push: `subscription.keys.auth`' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "authKey", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'User-Agent del navegador/app (max 500 chars)', maxLength: 500 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RegisterDeviceDto.prototype, "userAgent", void 0);
//# sourceMappingURL=register-device.dto.js.map