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
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
let TokenService = class TokenService {
    jwt;
    config;
    prisma;
    constructor(jwt, config, prisma) {
        this.jwt = jwt;
        this.config = config;
        this.prisma = prisma;
    }
    generateAccessToken(payload) {
        return this.jwt.sign(payload, {
            expiresIn: this.config.get('auth.jwtExpiresIn'),
            secret: this.config.get('auth.jwtSecret'),
        });
    }
    async createSession(userId, meta) {
        const rawToken = (0, crypto_1.randomBytes)(64).toString('hex');
        const hashedToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        const expiresDays = this.config.get('auth.refreshTokenExpiresDays') ?? 7;
        const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
        await this.prisma.session.create({
            data: {
                userId,
                refreshToken: hashedToken,
                userAgent: meta.userAgent,
                ipAddress: meta.ipAddress,
                expiresAt,
            },
        });
        return { refreshToken: rawToken, expiresAt };
    }
    async rotateRefreshToken(rawToken, meta) {
        const hashedToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        const session = await this.prisma.session.findUnique({
            where: { refreshToken: hashedToken },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            if (session) {
                await this.prisma.session.updateMany({
                    where: { userId: session.userId, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
            }
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        await this.prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
        });
        const { refreshToken, expiresAt } = await this.createSession(session.userId, meta);
        return { refreshToken, expiresAt, userId: session.userId };
    }
    async revokeSession(rawToken) {
        const hashedToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        await this.prisma.session.updateMany({
            where: { refreshToken: hashedToken, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async revokeAllUserSessions(userId) {
        await this.prisma.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService,
        prisma_service_1.PrismaService])
], TokenService);
//# sourceMappingURL=token.service.js.map