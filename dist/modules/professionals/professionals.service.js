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
exports.ProfessionalsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProfessionalsService = class ProfessionalsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.professionalProfile.findMany({
                skip,
                take: limit,
                include: { user: { select: { email: true, isActive: true } } },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.professionalProfile.count(),
        ]);
        return { items, total, page, limit };
    }
    async findByUserId(userId) {
        const profile = await this.prisma.professionalProfile.findUnique({
            where: { userId },
            include: { user: { select: { email: true } }, companyMemberships: { include: { companyProfile: true } } },
        });
        if (!profile)
            throw new common_1.NotFoundException('Professional profile not found');
        return profile;
    }
    async findOne(id) {
        const profile = await this.prisma.professionalProfile.findUnique({
            where: { id },
            include: { user: { select: { email: true, isActive: true } } },
        });
        if (!profile)
            throw new common_1.NotFoundException('Professional profile not found');
        return profile;
    }
    async update(userId, dto) {
        const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new common_1.NotFoundException('Professional profile not found');
        return this.prisma.professionalProfile.update({ where: { userId }, data: dto });
    }
    async adminUpdate(id, dto) {
        await this.findOne(id);
        return this.prisma.professionalProfile.update({ where: { id }, data: dto });
    }
    async verify(id) {
        await this.findOne(id);
        return this.prisma.professionalProfile.update({
            where: { id },
            data: { isVerified: true, verifiedAt: new Date(), status: 'ACTIVE' },
        });
    }
    async suspend(id) {
        await this.findOne(id);
        return this.prisma.professionalProfile.update({ where: { id }, data: { status: 'SUSPENDED' } });
    }
};
exports.ProfessionalsService = ProfessionalsService;
exports.ProfessionalsService = ProfessionalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProfessionalsService);
//# sourceMappingURL=professionals.service.js.map