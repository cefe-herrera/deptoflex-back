import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CancellationRequestStatus, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingsService } from './bookings.service';

@Injectable()
export class BookingCancellationRequestsService {
  private readonly logger = new Logger(BookingCancellationRequestsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private bookingsService: BookingsService,
  ) {}

  async requestCancellation(bookingId: string, userId: string, reason: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new ForbiddenException('Necesitás un perfil profesional');

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: { id: true, status: true, professionalProfileId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.professionalProfileId !== profile.id) {
      throw new ForbiddenException('No podés solicitar cancelación de esta reserva');
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Solo se pueden solicitar cancelaciones de reservas activas');
    }

    const existingPending = await this.prisma.bookingCancellationRequest.findFirst({
      where: { bookingId, status: CancellationRequestStatus.PENDING },
    });
    if (existingPending) {
      throw new ConflictException('Ya existe una solicitud de cancelación pendiente para esta reserva');
    }

    const request = await this.prisma.bookingCancellationRequest.create({
      data: {
        bookingId,
        requestedById: userId,
        reason,
      },
    });

    this.notifications.notifyCancellationRequested(bookingId, request.id).catch((err) =>
      this.logger.error(`notifyCancellationRequested failed for ${request.id}`, err),
    );

    return request;
  }

  async listRequests(status: CancellationRequestStatus = CancellationRequestStatus.PENDING) {
    const items = await this.prisma.bookingCancellationRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: {
            property: { select: { id: true, name: true } },
            propertyFlex: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true } },
            professionalProfile: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        requestedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    return { items, total: items.length };
  }

  async approve(requestId: string, adminUserId: string) {
    const request = await this.findPendingRequest(requestId);

    await this.bookingsService.executeCancellation(
      request.bookingId,
      request.reason,
      adminUserId,
    );

    await this.prisma.bookingCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: CancellationRequestStatus.APPROVED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
    });

    return { message: 'Cancellation approved', requestId };
  }

  async reject(requestId: string, adminUserId: string, adminNotes?: string) {
    const request = await this.findPendingRequest(requestId);

    const updated = await this.prisma.bookingCancellationRequest.update({
      where: { id: requestId },
      data: {
        status: CancellationRequestStatus.REJECTED,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
      },
    });

    this.notifications.notifyCancellationRejected(requestId).catch((err) =>
      this.logger.error(`notifyCancellationRejected failed for ${requestId}`, err),
    );

    return updated;
  }

  private async findPendingRequest(requestId: string) {
    const request = await this.prisma.bookingCancellationRequest.findUnique({
      where: { id: requestId },
      include: { booking: { select: { id: true, status: true, deletedAt: true } } },
    });
    if (!request) throw new NotFoundException('Cancellation request not found');
    if (request.status !== CancellationRequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }
    if (!request.booking || request.booking.deletedAt) {
      throw new NotFoundException('Booking not found');
    }
    if (request.booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('La reserva ya está cancelada');
    }
    return request;
  }
}
