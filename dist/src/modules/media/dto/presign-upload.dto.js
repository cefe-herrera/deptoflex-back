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
exports.PresignUploadDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
class PresignUploadDto {
    filename;
    contentType;
    fileSize;
    static _OPENAPI_METADATA_FACTORY() {
        return { filename: { required: true, type: () => String, maxLength: 255 }, contentType: { required: true, type: () => String, enum: ALLOWED_MIME_TYPES }, fileSize: { required: true, type: () => Number, minimum: 1, maximum: MAX_FILE_SIZE } };
    }
}
exports.PresignUploadDto = PresignUploadDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], PresignUploadDto.prototype, "filename", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(ALLOWED_MIME_TYPES),
    __metadata("design:type", String)
], PresignUploadDto.prototype, "contentType", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(MAX_FILE_SIZE),
    __metadata("design:type", Number)
], PresignUploadDto.prototype, "fileSize", void 0);
//# sourceMappingURL=presign-upload.dto.js.map