import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { TokenType } from '@prisma/client';

import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) { }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

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
        userRoles: {
          create: { roleId: 2 },
        },
        professionalProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
          },
        },
      },
    });

    const token = await this.createVerificationToken(user.id, TokenType.EMAIL_VERIFICATION);

    // Send email with token via Resend
    await this.emailService.sendVerificationEmail(user.email, token);

    return { id: user.id, email: user.email, message: 'Verification email sent' };
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) throw new ForbiddenException('Email not verified');
    if (!user.isActive) throw new ForbiddenException('Account is inactive');

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

  async refresh(rawToken: string, meta: { userAgent?: string; ipAddress?: string }) {
    const { refreshToken, expiresAt, userId } = await this.tokenService.rotateRefreshToken(rawToken, meta);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException();

    const roles = user.userRoles.map((ur) => ur.role.name);
    const accessToken = this.tokenService.generateAccessToken({ sub: user.id, email: user.email, roles });

    return { accessToken, refreshToken, expiresIn: 900, expiresAt };
  }

  async logout(rawToken: string) {
    await this.tokenService.revokeSession(rawToken);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    if (!dto?.token) {
      throw new BadRequestException('Token is required');
    }

    const record = await this.prisma.verificationToken.findUnique({ where: { token: dto.token } });
    if (!record || record.type !== TokenType.EMAIL_VERIFICATION || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true, emailVerifiedAt: new Date() } }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (user) {
      const token = await this.createVerificationToken(user.id, TokenType.PASSWORD_RESET, 3600);
      await this.emailService.sendPasswordResetEmail(user.email, token);
    }
    return { message: 'If that email is registered, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.verificationToken.findUnique({ where: { token: dto.token } });
    if (!record || record.type !== TokenType.PASSWORD_RESET || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
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

  async getMe(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        isActive: true,
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
          },
        },
      },
    });
  }

  private async createVerificationToken(
    userId: string,
    type: TokenType,
    ttlSeconds = 86400,
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.verificationToken.create({
      data: { userId, token, type, expiresAt },
    });

    return token;
  }
}
