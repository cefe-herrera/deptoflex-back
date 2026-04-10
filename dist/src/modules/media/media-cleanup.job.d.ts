import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
export declare class MediaCleanupJob {
    private prisma;
    private r2;
    private readonly logger;
    constructor(prisma: PrismaService, r2: R2Service);
    cleanOrphanedFiles(): Promise<void>;
}
