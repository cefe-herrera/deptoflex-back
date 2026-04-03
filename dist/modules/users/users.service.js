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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where: { deletedAt: null },
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    emailVerified: true,
                    isActive: true,
                    createdAt: true,
                    userRoles: { select: { role: { select: { name: true } } } },
                    professionalProfile: { select: { firstName: true, lastName: true, status: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where: { deletedAt: null } }),
        ]);
        return { items, total, page, limit };
    }
    async findOne(id) {
        const user = await this.prisma.user.findFirst({
            where: { id, deletedAt: null },
            select: {
                id: true,
                email: true,
                emailVerified: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                userRoles: { select: { role: { select: { id: true, name: true } } } },
                professionalProfile: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.user.update({
            where: { id },
            data: dto,
            select: { id: true, email: true, isActive: true, updatedAt: true },
        });
    }
    async softDelete(id) {
        await this.findOne(id);
        await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    }
    async assignRole(userId, roleId, assignedBy) {
        await this.findOne(userId);
        return this.prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId } },
            create: { userId, roleId, assignedBy },
            update: {},
        });
    }
    async removeRole(userId, roleId) {
        await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map