import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
export declare class ProfessionalsController {
    private professionalsService;
    private mediaService;
    constructor(professionalsService: ProfessionalsService, mediaService: MediaService);
    getMe(user: CurrentUserPayload): Promise<{
        user: {
            email: string;
        };
        companyMemberships: ({
            companyProfile: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                email: string | null;
                phone: string | null;
                isActive: boolean;
                address: string | null;
                taxId: string | null;
                website: string | null;
            };
        } & {
            id: string;
            role: import(".prisma/client").$Enums.CompanyRole;
            professionalProfileId: string;
            companyProfileId: string;
            joinedAt: Date;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    updateMe(user: CurrentUserPayload, dto: UpdateProfessionalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    findAll(page?: number, limit?: number): Promise<{
        items: ({
            user: {
                email: string;
                isActive: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            avatarUrl: string | null;
            bio: string | null;
            licenseNumber: string | null;
            defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
            isVerified: boolean;
            verifiedAt: Date | null;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
            ambassadorRequestedAt: Date | null;
        })[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        user: {
            email: string;
            isActive: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    adminUpdate(id: string, dto: AdminUpdateProfessionalDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    requestAmbassador(user: CurrentUserPayload): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    presignMyAvatar(user: CurrentUserPayload, dto: PresignUploadDto): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    confirmMyAvatar(user: CurrentUserPayload, dto: ConfirmUploadDto): Promise<{
        avatarUrl: string;
    }>;
    presignAvatar(id: string, user: CurrentUserPayload, dto: PresignUploadDto): Promise<{
        uploadUrl: string;
        objectKey: string;
        mediaFileId: string;
        expiresIn: number;
    }>;
    confirmAvatar(id: string, dto: ConfirmUploadDto): Promise<{
        avatarUrl: string;
    }>;
    verify(id: string): Promise<{
        message: string;
    }>;
    reject(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
    suspend(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        avatarUrl: string | null;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
}
