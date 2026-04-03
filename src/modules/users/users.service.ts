import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          isActive: true,
          createdAt: true,
          userRoles: { select: { role: { select: { name: true } } } },
          professionalProfile: { select: { firstName: true, lastName: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
        professionalProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, isActive: true, updatedAt: true },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async assignRole(userId: string, roleId: number, assignedBy: string) {
    await this.findOne(userId);
    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId, assignedBy },
      update: {},
    });
  }

  async removeRole(userId: string, roleId: number) {
    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } });
  }
}
