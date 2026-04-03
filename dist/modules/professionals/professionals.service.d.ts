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
    findByUserId(userId: string): Promise<{
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
    update(userId: string, dto: UpdateProfessionalDto): Promise<{
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
