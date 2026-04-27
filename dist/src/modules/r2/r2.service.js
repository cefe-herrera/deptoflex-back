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
exports.R2Service = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
let R2Service = class R2Service {
    config;
    client;
    bucket;
    publicBaseUrl;
    constructor(config) {
        this.config = config;
        this.client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: config.get('r2.endpoint'),
            credentials: {
                accessKeyId: config.get('r2.accessKeyId'),
                secretAccessKey: config.get('r2.secretAccessKey'),
            },
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
        this.bucket = config.get('r2.bucket');
        this.publicBaseUrl = config.get('r2.publicBaseUrl');
    }
    async generatePresignedPutUrl(objectKey, contentType, expiresIn = 300) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
            ContentType: contentType,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.client, command, { expiresIn });
    }
    async objectExists(objectKey) {
        try {
            await this.client.send(new client_s3_1.HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }));
            return true;
        }
        catch {
            return false;
        }
    }
    async deleteObject(objectKey) {
        await this.client.send(new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    }
    getPublicUrl(objectKey) {
        return `${this.publicBaseUrl}/${objectKey}`;
    }
    buildObjectKey(entity, entityId, filename) {
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
        return `${entity}/${entityId}/${(0, crypto_1.randomUUID)()}.${ext}`;
    }
};
exports.R2Service = R2Service;
exports.R2Service = R2Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], R2Service);
//# sourceMappingURL=r2.service.js.map