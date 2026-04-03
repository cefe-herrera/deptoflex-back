import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        id: string;
        email: string;
        message: string;
    }>;
    login(dto: LoginDto, req: Request): Promise<{
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
    refresh(dto: RefreshTokenDto, req: Request): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        expiresAt: Date;
    }>;
    logout(dto: LogoutDto): Promise<void>;
    verifyEmail(dto: VerifyEmailDto): Promise<{
        message: string;
    }>;
    verifyEmailGet(query: VerifyEmailDto): Promise<void>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    getMe(user: CurrentUserPayload): Promise<{
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
}
