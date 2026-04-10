import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getStats(): Promise<{
        totalUsers: number;
        totalProperties: number;
        pendingAmbassadors: number;
        activeAmbassadors: number;
        totalLeads: number;
        newLeads: number;
    }>;
}
