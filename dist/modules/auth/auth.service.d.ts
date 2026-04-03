import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
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
    constructor(prisma: PrismaService, tokenService: TokenService, emailService: EmailService);
    register(dto: RegisterDto): Promise<{
        id: string;
        email: string;
        message: string;
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
        id: string;
        email: string;
        emailVerified: boolean;
        isActive: boolean;
        createdAt: Date;
        userRoles: {
            role: {
                name: string;
            };
        }[];
        professionalProfile: {
            id: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            isVerified: boolean;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
        } | null;
    } | null>;
    private createVerificationToken;
}
