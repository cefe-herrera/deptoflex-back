"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const token_service_1 = require("./token.service");
const config_1 = require("@nestjs/config");
const google_auth_library_1 = require("google-auth-library");
const argon2 = __importStar(require("argon2"));
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const email_service_1 = require("../email/email.service");
let AuthService = class AuthService {
    prisma;
    tokenService;
    emailService;
    configService;
    googleClient;
    constructor(prisma, tokenService, emailService, configService) {
        this.prisma = prisma;
        this.tokenService = tokenService;
        this.emailService = emailService;
        this.configService = configService;
        this.googleClient = new google_auth_library_1.OAuth2Client(this.configService.get('app.googleClientId'));
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone ?? null,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                termsAcceptedAt: new Date(),
                userRoles: {
                    create: { role: { connect: { name: 'USER' } } },
                },
                professionalProfile: {
                    create: {
                        firstName: dto.firstName,
                        lastName: dto.lastName,
                        phone: dto.phone ?? null,
                    },
                },
            },
        });
        return { id: user.id, email: user.email };
    }
    async login(dto, meta) {
        const user = await this.prisma.user.findFirst({
            where: { email: dto.email, deletedAt: null },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await argon2.verify(user.passwordHash, dto.password);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!user.emailVerified)
            throw new common_1.ForbiddenException('Email not verified');
        if (!user.isActive)
            throw new common_1.ForbiddenException('Account is inactive');
        const roles = user.userRoles.map((ur) => ur.role.name);
        const accessToken = this.tokenService.generateAccessToken({
            sub: user.id,
            email: user.email,
            roles,
        });
        const { refreshToken, expiresAt } = await this.tokenService.createSession(user.id, meta);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
            expiresAt,
            user: { id: user.id, email: user.email, roles },
        };
    }
    async googleLogin(dto, meta) {
        let ticket;
        try {
            ticket = await this.googleClient.verifyIdToken({
                idToken: dto.token,
                audience: this.configService.get('app.googleClientId'),
            });
        }
        catch (error) {
            console.error('Google Auth Validation Error:', error);
            throw new common_1.UnauthorizedException('Invalid Google token');
        }
        const payload = ticket.getPayload();
        if (!payload?.email)
            throw new common_1.UnauthorizedException('Invalid Google payload');
        let user = await this.prisma.user.findFirst({
            where: { email: payload.email, deletedAt: null },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email: payload.email,
                    firstName: payload.given_name ?? '',
                    lastName: payload.family_name ?? '',
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                    passwordHash: await argon2.hash((0, crypto_1.randomBytes)(32).toString('hex')),
                    userRoles: {
                        create: { role: { connect: { name: 'USER' } } },
                    },
                    professionalProfile: {
                        create: {
                            firstName: payload.given_name ?? '',
                            lastName: payload.family_name ?? '',
                            phone: null,
                        },
                    },
                },
                include: { userRoles: { include: { role: true } } },
            });
        }
        if (!user.isActive)
            throw new common_1.ForbiddenException('Account is inactive');
        const roles = user.userRoles.map((ur) => ur.role.name);
        const accessToken = this.tokenService.generateAccessToken({
            sub: user.id,
            email: user.email,
            roles,
        });
        const { refreshToken, expiresAt } = await this.tokenService.createSession(user.id, meta);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
            expiresAt,
            user: { id: user.id, email: user.email, roles },
        };
    }
    async appleLogin(dto, meta) {
        throw new common_1.BadRequestException('Apple Sign-In is not yet implemented');
    }
    async refresh(rawToken, meta) {
        const { refreshToken, expiresAt, userId } = await this.tokenService.rotateRefreshToken(rawToken, meta);
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null, isActive: true },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user)
            throw new common_1.UnauthorizedException();
        const roles = user.userRoles.map((ur) => ur.role.name);
        const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email, roles });
        return { accessToken, refreshToken, expiresIn: 900, expiresAt };
    }
    async logout(rawToken) {
        await this.tokenService.revokeSession(rawToken);
    }
    async verifyEmail(dto) {
        if (!dto?.token) {
            throw new common_1.BadRequestException('Token is required');
        }
        const record = await this.prisma.verificationToken.findUnique({ where: { token: dto.token } });
        if (!record || record.type !== client_1.TokenType.EMAIL_VERIFICATION || record.usedAt || record.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
        await this.prisma.$transaction([
            this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true, emailVerifiedAt: new Date() } }),
        ]);
        return { message: 'Email verified successfully' };
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
        if (user) {
            const token = await this.createVerificationToken(user.id, client_1.TokenType.PASSWORD_RESET, 3600);
            await this.emailService.sendPasswordResetEmail(user.email, token);
        }
        return { message: 'If that email is registered, a reset link has been sent' };
    }
    async resetPassword(dto) {
        const record = await this.prisma.verificationToken.findUnique({ where: { token: dto.token } });
        if (!record || record.type !== client_1.TokenType.PASSWORD_RESET || record.usedAt || record.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
        const passwordHash = await argon2.hash(dto.password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
        await this.prisma.$transaction([
            this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
        ]);
        await this.tokenService.revokeAllUserSessions(record.userId);
        return { message: 'Password updated successfully' };
    }
    async getMe(userId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                emailVerified: true,
                isActive: true,
                termsAcceptedAt: true,
                createdAt: true,
                userRoles: { select: { role: { select: { name: true } } } },
                professionalProfile: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        status: true,
                        isVerified: true,
                        ambassadorRequestedAt: true,
                    },
                },
            },
        });
        if (!user)
            return null;
        const { userRoles, professionalProfile, ...rest } = user;
        return {
            ...rest,
            roles: userRoles.map((ur) => ur.role.name),
            professionalProfile,
        };
    }
    async createVerificationToken(userId, type, ttlSeconds = 86400) {
        const token = (0, crypto_1.randomBytes)(64).toString('hex');
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
        await this.prisma.verificationToken.create({
            data: { userId, token, type, expiresAt },
        });
        return token;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        token_service_1.TokenService,
        email_service_1.EmailService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map