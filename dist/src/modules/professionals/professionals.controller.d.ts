import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class ProfessionalsController {
    private professionalsService;
    constructor(professionalsService: ProfessionalsService);
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
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
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
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
        ambassadorRequestedAt: Date | null;
    }>;
}
