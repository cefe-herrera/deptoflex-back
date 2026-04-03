import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.professionalProfile.findMany({
        skip,
        take: limit,
        include: { user: { select: { email: true, isActive: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.professionalProfile.count(),
    ]);
    return { items, total, page, limit };
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } }, companyMemberships: { include: { companyProfile: true } } },
    });
    if (!profile) throw new NotFoundException('Professional profile not found');
    return profile;
  }

  async findOne(id: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id },
      include: { user: { select: { email: true, isActive: true } } },
    });
    if (!profile) throw new NotFoundException('Professional profile not found');
    return profile;
  }

  async update(userId: string, dto: UpdateProfessionalDto) {
    const profile = await this.prisma.professionalProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Professional profile not found');
    return this.prisma.professionalProfile.update({ where: { userId }, data: dto });
  }

  async adminUpdate(id: string, dto: AdminUpdateProfessionalDto) {
    await this.findOne(id);
    return this.prisma.professionalProfile.update({ where: { id }, data: dto });
  }

  async verify(id: string) {
    await this.findOne(id);
    return this.prisma.professionalProfile.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date(), status: 'ACTIVE' },
    });
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.professionalProfile.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }
}
