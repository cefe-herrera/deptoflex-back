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
                email: string | null;
                id: string;
                createdAt: Date;
                name: string;
                phone: string | null;
                isActive: boolean;
                updatedAt: Date;
                address: string | null;
                taxId: string | null;
                website: string | null;
            };
        } & {
            role: import(".prisma/client").$Enums.CompanyRole;
            id: string;
            professionalProfileId: string;
            companyProfileId: string;
            joinedAt: Date;
        })[];
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
    }>;
    updateMe(user: CurrentUserPayload, dto: UpdateProfessionalDto): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
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
            userId: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            updatedAt: Date;
            bio: string | null;
            licenseNumber: string | null;
            defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
            isVerified: boolean;
            verifiedAt: Date | null;
            status: import(".prisma/client").$Enums.ProfessionalStatus;
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
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
    }>;
    adminUpdate(id: string, dto: AdminUpdateProfessionalDto): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
    }>;
    verify(id: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
    }>;
    suspend(id: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        updatedAt: Date;
        bio: string | null;
        licenseNumber: string | null;
        defaultCommissionRate: import("@prisma/client/runtime/library").Decimal;
        isVerified: boolean;
        verifiedAt: Date | null;
        status: import(".prisma/client").$Enums.ProfessionalStatus;
    }>;
}
