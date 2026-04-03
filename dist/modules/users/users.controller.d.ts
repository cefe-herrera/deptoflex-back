import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMe(user: CurrentUserPayload): Promise<{
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
    updateMe(user: CurrentUserPayload, dto: UpdateUserDto): Promise<{
        email: string;
        id: string;
        isActive: boolean;
        updatedAt: Date;
    }>;
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
    remove(id: string): Promise<void>;
    assignRole(id: string, roleId: number, user: CurrentUserPayload): Promise<{
        userId: string;
        assignedAt: Date;
        assignedBy: string | null;
        roleId: number;
    }>;
    removeRole(id: string, roleId: number): Promise<void>;
}
