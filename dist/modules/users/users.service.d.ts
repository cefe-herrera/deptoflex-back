import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(page?: number, limit?: number): Promise<{
        items: {
            email: string;
            professionalProfile: {
                firstName: string;
                lastName: string;
                status: import(".prisma/client").$Enums.ProfessionalStatus;
            } | null;
            id: string;
            createdAt: Date;
            emailVerified: boolean;
            isActive: boolean;
            userRoles: {
                role: {
                    name: string;
                };
            }[];
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    findOne(id: string): Promise<{
        email: string;
        professionalProfile: {
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
        } | null;
        id: string;
        createdAt: Date;
        emailVerified: boolean;
        isActive: boolean;
        updatedAt: Date;
        userRoles: {
            role: {
                id: number;
                name: string;
            };
        }[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        email: string;
        id: string;
        isActive: boolean;
        updatedAt: Date;
    }>;
    softDelete(id: string): Promise<void>;
    assignRole(userId: string, roleId: number, assignedBy: string): Promise<{
        userId: string;
        roleId: number;
        assignedAt: Date;
        assignedBy: string | null;
    }>;
    removeRole(userId: string, roleId: number): Promise<void>;
}
