import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlexBookingPaymentStatus,
  FlexBookingStatus,
  PaymentProvider,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FlexBookingsService } from '../flex-bookings/flex-bookings.service';
import { MercadoPagoService } from './mercadopago.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class FlexBookingPaymentsService {
  private readonly logger = new Logger(FlexBookingPaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mercadoPago: MercadoPagoService,
    @Inject(forwardRef(() => FlexBookingsService))
    private flexBookings: FlexBookingsService,
  ) {}

  static generatePaymentToken(): string {
    return randomBytes(24).toString('hex');
  }

  buildPaymentPageUrl(paymentToken: string): string {
    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
    return `${frontendUrl.replace(/\/$/, '')}/p/flex/reserva/${paymentToken}/pagar`;
  }

  async getPaymentLinkForBooking(flexBookingId: string, user: CurrentUserPayload) {
    const booking = await this.getAuthorizedBooking(flexBookingId, user);
    return this.buildPaymentLinkResponse(booking);
  }

  async getPublicPaymentPage(paymentToken: string) {
    const booking = await this.prisma.flexBooking.findFirst({
      where: { paymentToken, deletedAt: null },
      include: {
        propertyFlex: { include: { address: true } },
        payments: {
          where: { status: FlexBookingPaymentStatus.APPROVED },
          orderBy: { paidAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const amount = booking.reservationPaymentAmount != null
      ? Number(booking.reservationPaymentAmount)
      : 0;
    const latestPending = await this.prisma.flexBookingPayment.findFirst({
      where: {
        flexBookingId: booking.id,
        status: FlexBookingPaymentStatus.PENDING,
        checkoutUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: booking.id,
      status: booking.status,
      clientName: booking.clientName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalMonths: booking.totalMonths,
      reservationPaymentAmount: amount,
      currency: booking.currency,
      property: {
        id: booking.propertyFlex.id,
        name: booking.propertyFlex.name,
        address: booking.propertyFlex.address,
      },
      isPaid: booking.status === FlexBookingStatus.CONFIRMED
        || booking.payments.length > 0,
      pendingCheckoutUrl: latestPending?.checkoutUrl ?? null,
    };
  }

  async createPublicCheckout(paymentToken: string) {
    if (!this.mercadoPago.isConfigured()) {
      throw new ServiceUnavailableException('Mercado Pago no está configurado');
    }

    const booking = await this.prisma.flexBooking.findFirst({
      where: { paymentToken, deletedAt: null },
      include: { propertyFlex: true },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    if (booking.status === FlexBookingStatus.CONFIRMED) {
      throw new BadRequestException('Esta reserva ya está confirmada');
    }
    if (booking.status === FlexBookingStatus.CANCELLED) {
      throw new BadRequestException('Esta reserva fue cancelada');
    }

    const amount = booking.reservationPaymentAmount != null
      ? Number(booking.reservationPaymentAmount)
      : 0;
    if (amount <= 0) {
      throw new BadRequestException('Esta reserva no requiere pago online');
    }

    const existingApproved = await this.prisma.flexBookingPayment.findFirst({
      where: {
        flexBookingId: booking.id,
        status: FlexBookingPaymentStatus.APPROVED,
      },
    });
    if (existingApproved) {
      throw new BadRequestException('El pago de esta reserva ya fue registrado');
    }

    const backUrlBase = this.buildPaymentPageUrl(paymentToken);
    const checkout = await this.mercadoPago.createFlexCheckout({
      flexBookingId: booking.id,
      title: `Reserva Flex — ${booking.propertyFlex.name}`,
      amount,
      currency: booking.currency,
      payerEmail: booking.clientEmail,
      backUrlBase,
    });

    const isProduction = this.config.get<string>('app.nodeEnv') === 'production';
    const checkoutUrl = isProduction
      ? checkout.checkoutUrl
      : (checkout.sandboxCheckoutUrl ?? checkout.checkoutUrl);

    await this.prisma.flexBookingPayment.create({
      data: {
        flexBookingId: booking.id,
        provider: PaymentProvider.MERCADOPAGO,
        status: FlexBookingPaymentStatus.PENDING,
        amount: String(amount),
        currency: booking.currency,
        mpPreferenceId: checkout.preferenceId,
        checkoutUrl,
      },
    });

    return { checkoutUrl };
  }

  async handleWebhook(query: Record<string, string | undefined>) {
    if (!this.mercadoPago.isConfigured()) {
      this.logger.warn('Mercado Pago webhook received but MP is not configured');
      return { ok: true };
    }

    const type = query.type ?? query.topic;
    const paymentId = query['data.id'] ?? query.id;

    if ((type === 'payment' || type === 'merchant_order') && paymentId) {
      await this.processPaymentNotification(String(paymentId));
    }

    return { ok: true };
  }

  async processPaymentNotification(mpPaymentId: string) {
    const payment = await this.mercadoPago.getPayment(mpPaymentId);

    if (payment.status === 'approved') {
      await this.confirmApprovedPayment(payment);
      return;
    }

    const flexBookingId = payment.externalReference;
    if (!flexBookingId) return;

    const status = this.mapMpStatus(payment.status);
    if (!status || status === FlexBookingPaymentStatus.APPROVED) return;

    await this.prisma.flexBookingPayment.updateMany({
      where: {
        flexBookingId,
        mpPaymentId: null,
        status: FlexBookingPaymentStatus.PENDING,
      },
      data: {
        mpPaymentId: payment.id,
        status,
      },
    });
  }

  private async confirmApprovedPayment(payment: {
    id: string;
    externalReference: string | null;
    transactionAmount: number;
    currencyId: string;
  }) {
    const flexBookingId = payment.externalReference;
    if (!flexBookingId) {
      this.logger.warn(`MP payment ${payment.id} has no external_reference`);
      return;
    }

    const booking = await this.prisma.flexBooking.findFirst({
      where: { id: flexBookingId, deletedAt: null },
    });
    if (!booking) {
      this.logger.warn(`Flex booking ${flexBookingId} not found for MP payment ${payment.id}`);
      return;
    }

    if (booking.status === FlexBookingStatus.CONFIRMED) {
      await this.prisma.flexBookingPayment.updateMany({
        where: { mpPaymentId: payment.id },
        data: { status: FlexBookingPaymentStatus.APPROVED, paidAt: new Date() },
      });
      return;
    }

    const expectedAmount = booking.reservationPaymentAmount != null
      ? Number(booking.reservationPaymentAmount)
      : 0;
    if (expectedAmount > 0 && Math.abs(payment.transactionAmount - expectedAmount) > 1) {
      this.logger.error(
        `MP payment ${payment.id} amount mismatch: paid ${payment.transactionAmount}, expected ${expectedAmount}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const pending = await tx.flexBookingPayment.findFirst({
        where: {
          flexBookingId,
          status: FlexBookingPaymentStatus.PENDING,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (pending) {
        await tx.flexBookingPayment.update({
          where: { id: pending.id },
          data: {
            status: FlexBookingPaymentStatus.APPROVED,
            mpPaymentId: payment.id,
            paidAt: new Date(),
          },
        });
      } else {
        await tx.flexBookingPayment.create({
          data: {
            flexBookingId,
            provider: PaymentProvider.MERCADOPAGO,
            status: FlexBookingPaymentStatus.APPROVED,
            amount: String(expectedAmount || payment.transactionAmount),
            currency: booking.currency,
            mpPaymentId: payment.id,
            paidAt: new Date(),
          },
        });
      }
    });

    await this.flexBookings.confirmFromPayment(flexBookingId, payment.id);
  }

  private mapMpStatus(status: string): FlexBookingPaymentStatus | null {
    switch (status) {
      case 'rejected':
        return FlexBookingPaymentStatus.REJECTED;
      case 'cancelled':
        return FlexBookingPaymentStatus.CANCELLED;
      case 'refunded':
        return FlexBookingPaymentStatus.REFUNDED;
      case 'pending':
      case 'in_process':
        return FlexBookingPaymentStatus.PENDING;
      default:
        return null;
    }
  }

  private async getAuthorizedBooking(flexBookingId: string, user: CurrentUserPayload) {
    const booking = await this.prisma.flexBooking.findFirst({
      where: { id: flexBookingId, deletedAt: null },
      include: {
        propertyFlex: { include: { address: true } },
        payments: {
          where: { status: FlexBookingPaymentStatus.APPROVED },
          take: 1,
        },
      },
    });
    if (!booking) throw new NotFoundException('FlexBooking not found');

    const isStaff = user.roles?.some((r) => ['ADMIN', 'OPERATOR'].includes(r));
    if (!isStaff) {
      const profile = await this.prisma.professionalProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!profile || booking.professionalProfileId !== profile.id) {
        throw new ForbiddenException('No tenés acceso a esta reserva');
      }
    }

    return booking;
  }

  private buildPaymentLinkResponse(booking: {
    id: string;
    status: FlexBookingStatus;
    paymentToken: string | null;
    reservationPaymentAmount: unknown;
    currency: string;
    payments: { id: string }[];
  }) {
    const amount = booking.reservationPaymentAmount != null
      ? Number(booking.reservationPaymentAmount)
      : 0;

    if (amount <= 0) {
      return {
        requiresPayment: false,
        paymentUrl: null,
        amount: 0,
        currency: booking.currency,
        bookingStatus: booking.status,
        isPaid: booking.status === FlexBookingStatus.CONFIRMED,
      };
    }

    if (!booking.paymentToken) {
      throw new BadRequestException('Esta reserva no tiene link de pago generado');
    }

    return {
      requiresPayment: true,
      paymentUrl: this.buildPaymentPageUrl(booking.paymentToken),
      amount,
      currency: booking.currency,
      bookingStatus: booking.status,
      isPaid: booking.status === FlexBookingStatus.CONFIRMED || booking.payments.length > 0,
    };
  }
}
