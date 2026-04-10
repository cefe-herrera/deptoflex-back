import { PrismaService } from '../prisma/prisma.service';
export declare class CommissionsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.CommissionStatus;
        currency: string;
        bookingId: string;
        notes: string | null;
        baseAmount: import("@prisma/client/runtime/library").Decimal;
        professionalProfileId: string | null;
        rate: import("@prisma/client/runtime/library").Decimal;
        commissionAmount: import("@prisma/client/runtime/library").Decimal;
        paidAt: Date | null;
    }[]>;
}
