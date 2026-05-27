import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlexBookingDto } from './dto/create-flex-booking.dto';
import { UpdateFlexBookingDto } from './dto/update-flex-booking.dto';
import { QueryFlexBookingDto } from './dto/query-flex-booking.dto';

@Injectable()
export class FlexBookingsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFlexBookingDto) {
    const propertyFlex = await this.prisma.propertyFlex.findFirst({
      where: { id: dto.propertyFlexId, deletedAt: null },
    });
    if (!propertyFlex) throw new NotFoundException('PropertyFlex not found');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start >= end) throw new BadRequestException('startDate must be before endDate');

    const conflict = await this.prisma.flexBooking.findFirst({
      where: {
        propertyFlexId: dto.propertyFlexId,
        deletedAt: null,
        status: { notIn: ['CANCELLED'] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });
    if (conflict) throw new BadRequestException('PropertyFlex is not available for the requested period');

    return this.prisma.flexBooking.create({
      data: {
        ...dto,
        startDate: start,
        endDate: end,
        monthlyAmount: String(dto.monthlyAmount),
        totalAmount: String(dto.totalAmount),
        ...(dto.depositAmount != null && { depositAmount: String(dto.depositAmount) }),
      },
      include: {
        propertyFlex: { include: { address: true } },
      },
    });
  }

  async findAll(query: QueryFlexBookingDto) {
    const { page = 1, limit = 20, propertyFlexId, professionalProfileId, status, startDateFrom, startDateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(propertyFlexId && { propertyFlexId }),
      ...(professionalProfileId && { professionalProfileId }),
      ...(status && { status }),
      ...(startDateFrom && { startDate: { gte: new Date(startDateFrom) } }),
      ...(startDateTo && { startDate: { lte: new Date(startDateTo) } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.flexBooking.findMany({
        where,
        skip,
        take: limit,
        include: {
          propertyFlex: { include: { address: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.flexBooking.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const booking = await this.prisma.flexBooking.findFirst({
      where: { id, deletedAt: null },
      include: {
        propertyFlex: { include: { address: true, images: { where: { isPrimary: true }, include: { mediaFile: true }, take: 1 } } },
      },
    });
    if (!booking) throw new NotFoundException('FlexBooking not found');
    return booking;
  }

  async update(id: string, dto: UpdateFlexBookingDto) {
    await this.findOne(id);
    return this.prisma.flexBooking.update({
      where: { id },
      data: dto,
      include: { propertyFlex: { include: { address: true } } },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.flexBooking.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }
}
