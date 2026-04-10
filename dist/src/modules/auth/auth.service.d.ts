import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailService } from '../email/email.service';
export declare class AuthService {
    private prisma;
    private tokenService;
    private emailService;
    private configService;
    private googleClient;
    constructor(prisma: PrismaService, tokenService: TokenService, emailService: EmailService, configService: ConfigService);
    register(dto: RegisterDto): Promise<{
        id: string;
        email: string;
    }>;
    login(dto: LoginDto, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        expiresAt: Date;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    googleLogin(dto: {
        token: string;
    }, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        expiresAt: Date;
        user: {
            id: string;
            email: string;
            roles: string[];
        };
    }>;
    appleLogin(dto: {
        token: string;
        firstName?: string;
        lastName?: string;
    }, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<void>;
    refresh(rawToken: string, meta: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        expiresAt: Date;
    }>;
    logout(rawToken: string): Promise<void>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    getMe(userId: string): Promise<{
        roles: string[];
        professionalProfile: {
            id: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            isVerified: boolean;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
            ambassadorRequestedAt: Date | null;
        } | null;
        id: string;
        createdAt: Date;
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        emailVerified: boolean;
        termsAcceptedAt: Date | null;
        isActive: boolean;
    } | null>;
    private createVerificationToken;
}
