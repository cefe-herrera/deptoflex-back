import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      totalProperties,
      pendingAmbassadors,
      activeAmbassadors,
      totalLeads,
      newLeads,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.property.count({ where: { deletedAt: null } }),
      this.prisma.professionalProfile.count({
        where: { ambassadorRequestedAt: { not: null }, status: 'PENDING' },
      }),
      this.prisma.professionalProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'NEW' } }),
    ]);

    return {
      totalUsers,
      totalProperties,
      pendingAmbassadors,
      activeAmbassadors,
      totalLeads,
      newLeads,
    };
  }
}
