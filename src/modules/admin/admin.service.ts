import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { countAmbassadorsWithIncompleteDocs } from '../professionals/ambassador-documents.util';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      totalProperties,
      activeAmbassadors,
      incompleteDocsProfiles,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.property.count({ where: { deletedAt: null } }),
      this.prisma.professionalProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.professionalProfile.findMany({
        where: { status: 'ACTIVE' },
        select: {
          personType: true,
          ambassadorDocuments: { select: { documentType: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      totalProperties,
      activeAmbassadors,
      ambassadorsIncompleteDocs: countAmbassadorsWithIncompleteDocs(incompleteDocsProfiles),
    };
  }
}
