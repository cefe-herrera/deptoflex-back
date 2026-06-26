import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CommissionWorkflowService {
  constructor(private prisma: PrismaService) {}

  async approveOnFlexBookingConfirmed(bookingId: string, tx?: Tx) {
    const client = tx ?? this.prisma;
    await client.commission.updateMany({
      where: {
        bookingId,
        status: CommissionStatus.PENDING,
        settlementId: null,
      },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  async approveTrustedTemporalOnConfirm(bookingId: string, tx: Tx) {
    await tx.commission.updateMany({
      where: {
        bookingId,
        status: CommissionStatus.PENDING,
        settlementId: null,
      },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  async approveCommission(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({ where: { id: commissionId } });
    if (!commission) throw new NotFoundException('Commission not found');
    if (commission.status === CommissionStatus.PAID) {
      throw new BadRequestException('Cannot approve a paid commission');
    }
    if (commission.status === CommissionStatus.CANCELLED) {
      throw new BadRequestException('Cannot approve a cancelled commission');
    }
    if (commission.settlementId) {
      throw new BadRequestException('Commission is already assigned to a settlement');
    }
    if (commission.status === CommissionStatus.APPROVED) {
      return commission;
    }
    if (
      commission.status !== CommissionStatus.PENDING
      && commission.status !== CommissionStatus.PENDING_VALIDATION
    ) {
      throw new BadRequestException('Commission cannot be approved from its current status');
    }

    return this.prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  async cancelForBooking(bookingId: string, tx?: Tx) {
    const client = tx ?? this.prisma;
    await client.commission.updateMany({
      where: {
        bookingId,
        status: { notIn: [CommissionStatus.PAID, CommissionStatus.CANCELLED] },
      },
      data: { status: CommissionStatus.CANCELLED },
    });
  }
}
