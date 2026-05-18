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
exports.CreateReservationIntentDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateReservationIntentDto {
    propertyId;
    roomTypeId;
    rateId;
    checkin;
    checkout;
    currencyCode;
    lang;
    adults;
    children;
    totalAmount;
    static _OPENAPI_METADATA_FACTORY() {
        return { propertyId: { required: true, type: () => String, format: "uuid" }, roomTypeId: { required: true, type: () => String, minLength: 1, maxLength: 50 }, rateId: { required: false, type: () => String, minLength: 1, maxLength: 50 }, checkin: { required: true, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, checkout: { required: true, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, currencyCode: { required: false, type: () => String, minLength: 3, maxLength: 3 }, lang: { required: false, type: () => String, minLength: 2, maxLength: 5 }, adults: { required: false, type: () => Number, minimum: 1, maximum: 20 }, children: { required: false, type: () => Number, minimum: 0, maximum: 20 }, totalAmount: { required: false, type: () => Number, minimum: 0 } };
    }
}
exports.CreateReservationIntentDto = CreateReservationIntentDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cloudbeds room_type_id from the search response' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "roomTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Cloudbeds rate_id from the search response' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "rateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-16' }),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "checkin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-18' }),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "checkout", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'ARS' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "currencyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'es' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 5),
    __metadata("design:type", String)
], CreateReservationIntentDto.prototype, "lang", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 2, default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CreateReservationIntentDto.prototype, "adults", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CreateReservationIntentDto.prototype, "children", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 95000, description: 'Expected total amount (optional, validated server-side)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateReservationIntentDto.prototype, "totalAmount", void 0);
//# sourceMappingURL=create-reservation-intent.dto.js.map