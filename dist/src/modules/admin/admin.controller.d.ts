import { AdminService } from './admin.service';
export declare class AdminController {
    private adminService;
    constructor(adminService: AdminService);
    getStats(): Promise<{
        totalUsers: number;
        totalProperties: number;
        pendingAmbassadors: number;
        activeAmbassadors: number;
        totalLeads: number;
        newLeads: number;
    }>;
}
