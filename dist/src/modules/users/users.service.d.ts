import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(page?: number, limit?: number): Promise<{
        items: {
            id: string;
            createdAt: Date;
            userRoles: {
                role: {
                    name: string;
                };
            }[];
            professionalProfile: {
                firstName: string;
                lastName: string;
                status: import(".prisma/client").$Enums.ProfessionalStatus;
            } | null;
            email: string;
            emailVerified: boolean;
            isActive: boolean;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userRoles: {
            role: {
                id: number;
                name: string;
            };
        }[];
        professionalProfile: {
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
        } | null;
        email: string;
        emailVerified: boolean;
        isActive: boolean;
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        id: string;
        updatedAt: Date;
        email: string;
        isActive: boolean;
    }>;
    softDelete(id: string): Promise<void>;
    assignRole(userId: string, roleId: number, assignedBy: string): Promise<{
        userId: string;
        assignedAt: Date;
        assignedBy: string | null;
        roleId: number;
    }>;
    removeRole(userId: string, roleId: number): Promise<void>;
}
