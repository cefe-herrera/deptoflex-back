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
exports.CalculateTotalsDto = exports.CalculateTotalsRateDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class CalculateTotalsRateDto {
    rateId;
    adults;
    kids;
    static _OPENAPI_METADATA_FACTORY() {
        return { rateId: { required: true, type: () => String, minLength: 1, maxLength: 50 }, adults: { required: true, type: () => Number, minimum: 1, maximum: 20 }, kids: { required: false, type: () => Number, minimum: 0, maximum: 20 } };
    }
}
exports.CalculateTotalsRateDto = CalculateTotalsRateDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cloudbeds rateId for the chosen room/rate', example: '551718' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], CalculateTotalsRateDto.prototype, "rateId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, minimum: 1, maximum: 20 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CalculateTotalsRateDto.prototype, "adults", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 0, default: 0, minimum: 0, maximum: 20 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(20),
    __metadata("design:type", Number)
], CalculateTotalsRateDto.prototype, "kids", void 0);
class CalculateTotalsDto {
    propertyId;
    checkin;
    checkout;
    currencyCode;
    lang;
    rates;
    static _OPENAPI_METADATA_FACTORY() {
        return { propertyId: { required: true, type: () => String, minLength: 1, maxLength: 50 }, checkin: { required: true, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, checkout: { required: true, type: () => String, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, currencyCode: { required: false, type: () => String, minLength: 3, maxLength: 3 }, lang: { required: false, type: () => String, minLength: 2, maxLength: 5 }, rates: { required: true, type: () => [require("./calculate-totals.dto").CalculateTotalsRateDto], minItems: 1, maxItems: 10 } };
    }
}
exports.CalculateTotalsDto = CalculateTotalsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cloudbeds widget property id (e.g. "179484")' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 50),
    __metadata("design:type", String)
], CalculateTotalsDto.prototype, "propertyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-20' }),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], CalculateTotalsDto.prototype, "checkin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-05-21' }),
    (0, class_validator_1.IsISO8601)({ strict: true }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    __metadata("design:type", String)
], CalculateTotalsDto.prototype, "checkout", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'ARS', default: 'ARS' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CalculateTotalsDto.prototype, "currencyCode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'es', default: 'es' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(2, 5),
    __metadata("design:type", String)
], CalculateTotalsDto.prototype, "lang", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Selected rates to price. At least one required.',
        type: [CalculateTotalsRateDto],
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(10),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CalculateTotalsRateDto),
    __metadata("design:type", Array)
], CalculateTotalsDto.prototype, "rates", void 0);
//# sourceMappingURL=calculate-totals.dto.js.map