import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMe(user: CurrentUserPayload): Promise<{
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
    updateMe(user: CurrentUserPayload, dto: UpdateUserDto): Promise<{
        id: string;
        updatedAt: Date;
        email: string;
        isActive: boolean;
    }>;
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
    remove(id: string): Promise<void>;
    assignRole(id: string, roleId: number, user: CurrentUserPayload): Promise<{
        userId: string;
        assignedAt: Date;
        assignedBy: string | null;
        roleId: number;
    }>;
    removeRole(id: string, roleId: number): Promise<void>;
}
