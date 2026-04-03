import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class TokenService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) { }

  generateAccessToken(payload: { sub: string; email: string; roles: string[] }): string {
    return this.jwt.sign(payload, {
      expiresIn: this.config.get<string>('auth.jwtExpiresIn') as any,
      secret: this.config.get<string>('auth.jwtSecret'),
    });
  }

  async createSession(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ refreshToken: string; expiresAt: Date }> {
    const rawToken = randomBytes(64).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresDays = this.config.get<number>('auth.refreshTokenExpiresDays') ?? 7;
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

  async rotateRefreshToken(
    rawToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ refreshToken: string; expiresAt: Date; userId: string }> {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

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
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { refreshToken, expiresAt } = await this.createSession(session.userId, meta);
    return { refreshToken, expiresAt, userId: session.userId };
  }

  async revokeSession(rawToken: string): Promise<void> {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.session.updateMany({
      where: { refreshToken: hashedToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
