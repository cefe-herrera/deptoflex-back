import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class TokenService {
    private jwt;
    private config;
    private prisma;
    constructor(jwt: JwtService, config: ConfigService, prisma: PrismaService);
    generateAccessToken(payload: {
        sub: string;
        email: string;
        roles: string[];
    }): string;
    createSession(userId: string, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        refreshToken: string;
        expiresAt: Date;
    }>;
    rotateRefreshToken(rawToken: string, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        refreshToken: string;
        expiresAt: Date;
        userId: string;
    }>;
    revokeSession(rawToken: string): Promise<void>;
    revokeAllUserSessions(userId: string): Promise<void>;
}
