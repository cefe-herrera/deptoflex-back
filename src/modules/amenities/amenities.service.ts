import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';

@Injectable()
export class AmenitiesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.amenity.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  create(dto: CreateAmenityDto) {
    return this.prisma.amenity.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateAmenityDto>) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    return this.prisma.amenity.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const amenity = await this.prisma.amenity.findUnique({ where: { id } });
    if (!amenity) throw new NotFoundException('Amenity not found');
    await this.prisma.amenity.delete({ where: { id } });
  }
}
