import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';
export declare class ProfessionalsService {
    private prisma;
    constructor(prisma: PrismaService);
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
    getProfileIdByUserId(userId: string): Promise<string>;
    findByUserId(userId: string): Promise<{
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
    update(userId: string, dto: UpdateProfessionalDto): Promise<{
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
    requestAmbassador(userId: string): Promise<{
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
