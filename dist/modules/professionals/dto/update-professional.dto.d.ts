import { ProfessionalStatus } from '@prisma/client';
export declare class UpdateProfessionalDto {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    licenseNumber?: string;
}
export declare class AdminUpdateProfessionalDto extends UpdateProfessionalDto {
    defaultCommissionRate?: string;
    status?: ProfessionalStatus;
}
