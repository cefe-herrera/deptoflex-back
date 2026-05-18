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
var AvailabilitySnapshotsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilitySnapshotsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AvailabilitySnapshotsService = AvailabilitySnapshotsService_1 = class AvailabilitySnapshotsService {
    prisma;
    logger = new common_1.Logger(AvailabilitySnapshotsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(params) {
        try {
            await this.prisma.availabilitySnapshot.create({
                data: {
                    propertyId: params.propertyId,
                    checkin: new Date(params.checkin),
                    checkout: new Date(params.checkout),
                    currencyCode: params.currencyCode,
                    lang: params.lang,
                    rawResponseJson: params.result.raw,
                    normalizedResponseJson: {
                        propertyExternalId: params.result.propertyExternalId,
                        totalAvailable: params.result.totalAvailable,
                        rooms: params.result.rooms,
                        meta: params.result.meta ?? null,
                    },
                    totalAvailable: params.result.totalAvailable,
                    httpStatus: params.result.httpStatus,
                    durationMs: params.result.durationMs,
                },
            });
        }
        catch (err) {
            this.logger.warn(`Failed to persist availability snapshot: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
};
exports.AvailabilitySnapshotsService = AvailabilitySnapshotsService;
exports.AvailabilitySnapshotsService = AvailabilitySnapshotsService = AvailabilitySnapshotsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AvailabilitySnapshotsService);
//# sourceMappingURL=availability-snapshots.service.js.map