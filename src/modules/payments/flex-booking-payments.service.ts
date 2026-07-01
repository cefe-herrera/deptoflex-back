import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
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
import { EmailService } from '../email/email.service';
import { MercadoPagoService } from './mercadopago.service';
import {
  extractMercadoPagoWebhookEvent,
  validateMercadoPagoWebhookSignature,
} from './mercadopago-webhook.util';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

export interface SyncPublicPaymentInput {
  paymentId?: string;
  merchantOrderId?: string;
}

@Injectable()
export class FlexBookingPaymentsService {
  private readonly logger = new Logger(FlexBookingPaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mercadoPago: MercadoPagoService,
    private emailService: EmailService,
    @Inject(forwardRef(() => FlexBookingsService))
    private flexBookings: FlexBookingsService,
  ) {}

  static generatePaymentToken(): string {
    return randomBytes(24).toString('hex');
  }

  private paymentLinkExpirationDays(): number {
    const days = this.config.get<number>('mercadopago.paymentLinkExpirationDays') ?? 7;
    return Number.isFinite(days) && days > 0 ? days : 7;
  }

  private paymentLinkExpirationCutoff(): Date {
    return new Date(Date.now() - this.paymentLinkExpirationDays() * 24 * 60 * 60 * 1000);
  }

  buildPaymentPageUrl(paymentToken: string): string {
    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
    return `${frontendUrl.replace(/\/$/, '')}/p/flex/reserva/${paymentToken}/pagar`;
  }

  async notifyGuestPaymentRequired(input: {
    clientEmail: string;
    clientName: string;
    propertyName: string;
    amount: number;
    currency: string;
    paymentToken: string;
    startDate: Date;
    endDate: Date;
  }) {
    const paymentUrl = this.buildPaymentPageUrl(input.paymentToken);
    await this.emailService.sendFlexReservationPaymentEmail(
      input.clientEmail,
      input.clientName,
      input.propertyName,
      input.amount,
      input.currency,
      paymentUrl,
      input.startDate,
      input.endDate,
    );
  }

  async getPaymentLinkForBooking(flexBookingId: string, user: CurrentUserPayload) {
    const booking = await this.getAuthorizedBooking(flexBookingId, user);
    return this.buildPaymentLinkResponse(booking);
  }

  async resendPaymentEmail(flexBookingId: string, user: CurrentUserPayload) {
    const booking = await this.getAuthorizedBooking(flexBookingId, user);
    const amount = booking.reservationPaymentAmount != null
      ? Number(booking.reservationPaymentAmount)
      : 0;

    if (amount <= 0) {
      throw new BadRequestException('Esta reserva no requiere pago online');
    }
    if (!booking.paymentToken) {
      throw new BadRequestException('Esta reserva no tiene link de pago generado');
    }
    if (booking.status === FlexBookingStatus.CONFIRMED || booking.payments.length > 0) {
      throw new BadRequestException('Esta reserva ya está pagada');
    }
    if (!booking.clientEmail?.trim()) {
      throw new BadRequestException('La reserva no tiene email del huésped para reenviar');
    }

    await this.notifyGuestPaymentRequired({
      clientEmail: booking.clientEmail.trim(),
      clientName: booking.clientName,
      propertyName: booking.propertyFlex.name,
      amount,
      currency: booking.currency,
      paymentToken: booking.paymentToken,
      startDate: booking.startDate,
      endDate: booking.endDate,
    });

    return { sent: true, paymentUrl: this.buildPaymentPageUrl(booking.paymentToken) };
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
    const expirationCutoff = this.paymentLinkExpirationCutoff();
    const latestPending = await this.prisma.flexBookingPayment.findFirst({
      where: {
        flexBookingId: booking.id,
        status: FlexBookingPaymentStatus.PENDING,
        checkoutUrl: { not: null },
        createdAt: { gt: expirationCutoff },
      },
      orderBy: { createdAt: 'desc' },
    });

    const latestPayment = await this.prisma.flexBookingPayment.findFirst({
      where: { flexBookingId: booking.id },
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
      paymentStatus: latestPayment?.status ?? null,
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

    const expirationCutoff = this.paymentLinkExpirationCutoff();
    const reusablePending = await this.prisma.flexBookingPayment.findFirst({
      where: {
        flexBookingId: booking.id,
        status: FlexBookingPaymentStatus.PENDING,
        checkoutUrl: { not: null },
        createdAt: { gt: expirationCutoff },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusablePending?.checkoutUrl) {
      this.logger.log(`Reusing pending checkout booking=${booking.id} preference=${reusablePending.mpPreferenceId}`);
      return { checkoutUrl: reusablePending.checkoutUrl };
    }

    await this.prisma.flexBookingPayment.updateMany({
      where: {
        flexBookingId: booking.id,
        status: FlexBookingPaymentStatus.PENDING,
      },
      data: { status: FlexBookingPaymentStatus.CANCELLED },
    });

    const expirationDays = this.paymentLinkExpirationDays();
    const backUrlBase = this.buildPaymentPageUrl(paymentToken);
    const checkout = await this.mercadoPago.createFlexCheckout({
      flexBookingId: booking.id,
      title: `Reserva Flex — ${booking.propertyFlex.name}`,
      amount,
      currency: booking.currency,
      payerEmail: booking.clientEmail,
      backUrlBase,
      expirationDays,
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

    this.logger.log(
      `Checkout created booking=${booking.id} preference=${checkout.preferenceId} amount=${amount} ${booking.currency}`,
    );

    return { checkoutUrl };
  }

  async syncPublicPayment(paymentToken: string, input: SyncPublicPaymentInput = {}) {
    if (!this.mercadoPago.isConfigured()) {
      throw new ServiceUnavailableException('Mercado Pago no está configurado');
    }

    const booking = await this.prisma.flexBooking.findFirst({
      where: { paymentToken, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    this.logger.log(
      `Sync payment booking=${booking.id} status=${booking.status} `
      + `paymentId=${input.paymentId ?? '-'} merchantOrderId=${input.merchantOrderId ?? '-'}`,
    );

    await this.syncBookingPayments(booking.id, input);
    const page = await this.getPublicPaymentPage(paymentToken);
    this.logger.log(`Sync result booking=${booking.id} isPaid=${page.isPaid} status=${page.status}`);
    return page;
  }

  async reconcilePendingPayments() {
    if (!this.mercadoPago.isConfigured()) return { processed: 0 };

    const pendingBookings = await this.prisma.flexBooking.findMany({
      where: {
        deletedAt: null,
        status: FlexBookingStatus.PENDING,
        reservationPaymentAmount: { gt: 0 },
      },
      select: { id: true },
      take: 50,
    });

    let processed = 0;
    for (const booking of pendingBookings) {
      try {
        const before = await this.prisma.flexBooking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });
        await this.syncBookingPayments(booking.id);
        const after = await this.prisma.flexBooking.findUnique({
          where: { id: booking.id },
          select: { status: true },
        });
        if (before?.status !== after?.status) processed += 1;
      } catch (err) {
        this.logger.warn(`Reconcile failed for flex booking ${booking.id}`, err);
      }
    }

    return { processed };
  }

  async handleWebhook(
    query: Record<string, string | undefined>,
    body: unknown,
    headers?: { xSignature?: string; xRequestId?: string; dataId?: string },
  ) {
    if (!this.mercadoPago.isConfigured()) {
      this.logger.warn('Mercado Pago webhook received but MP is not configured');
      return { ok: true };
    }

    const event = extractMercadoPagoWebhookEvent(query, body);
    const dataId = headers?.dataId ?? event?.resourceId;

    this.logger.log(
      `Webhook parsed event=${event ? `${event.type}:${event.resourceId}` : 'none'} `
      + `dataId=${dataId ?? '-'} xRequestId=${headers?.xRequestId ?? '-'}`,
    );

    const webhookSecret = this.config.get<string>('mercadopago.webhookSecret') ?? '';
    if (webhookSecret) {
      const valid = validateMercadoPagoWebhookSignature(
        { xSignature: headers?.xSignature, xRequestId: headers?.xRequestId },
        dataId,
        webhookSecret,
      );
      this.logger.log(`Webhook signature validation=${valid ? 'OK' : 'FAILED'}`);
      if (!valid) {
        this.logger.warn(
          `Invalid Mercado Pago webhook signature dataId=${dataId ?? '-'} `
          + `hasXSignature=${!!headers?.xSignature}`,
        );
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else {
      this.logger.warn('MERCADOPAGO_WEBHOOK_SECRET not set — webhook signature not validated');
    }

    if (!event) {
      this.logger.warn(`Webhook ignored: unrecognized payload queryKeys=${Object.keys(query).join(',')}`);
      return { ok: true };
    }

    try {
      if (event.type === 'payment' || event.type.startsWith('payment.')) {
        this.logger.log(`Processing payment webhook id=${event.resourceId}`);
        await this.processPaymentNotification(event.resourceId);
      } else if (event.type === 'merchant_order') {
        this.logger.log(`Processing merchant_order webhook id=${event.resourceId}`);
        await this.processMerchantOrderNotification(event.resourceId);
      } else {
        this.logger.log(`Webhook ignored: unsupported type=${event.type}`);
      }
    } catch (err) {
      this.logger.error(
        `Webhook processing failed type=${event.type} id=${event.resourceId}`,
        err instanceof Error ? err.stack : err,
      );
    }

    this.logger.log(`Webhook handled type=${event.type} id=${event.resourceId}`);
    return { ok: true };
  }

  async processMerchantOrderNotification(merchantOrderId: string) {
    this.logger.log(`Fetching merchant order ${merchantOrderId}`);
    const order = await this.mercadoPago.getMerchantOrderContext(merchantOrderId);
    this.logger.log(
      `Merchant order ${merchantOrderId} paymentIds=[${order.paymentIds.join(',')}] `
      + `externalReference=${order.externalReference ?? '-'}`,
    );

    if (order.paymentIds.length > 0) {
      for (const paymentId of order.paymentIds) {
        await this.processPaymentNotification(paymentId);
      }
      return;
    }

    this.logger.log(
      `Merchant order ${merchantOrderId} has no payments yet — syncing by external_reference`,
    );

    if (order.externalReference) {
      await this.syncBookingPayments(order.externalReference);
      return;
    }

    this.logger.log(`Merchant order ${merchantOrderId} retrying in 2s…`);
    await this.delay(2000);
    const retry = await this.mercadoPago.getMerchantOrderContext(merchantOrderId);
    this.logger.log(
      `Merchant order ${merchantOrderId} retry paymentIds=[${retry.paymentIds.join(',')}] `
      + `externalReference=${retry.externalReference ?? '-'}`,
    );

    if (retry.paymentIds.length > 0) {
      for (const paymentId of retry.paymentIds) {
        await this.processPaymentNotification(paymentId);
      }
      return;
    }

    if (retry.externalReference) {
      await this.syncBookingPayments(retry.externalReference);
      return;
    }

    this.logger.warn(`Merchant order ${merchantOrderId} has no payments or external_reference after retry`);
  }

  async processPaymentNotification(mpPaymentId: string) {
    this.logger.log(`Fetching MP payment ${mpPaymentId}`);
    const payment = await this.mercadoPago.getPayment(mpPaymentId);
    this.logger.log(
      `MP payment ${payment.id} status=${payment.status} `
      + `externalReference=${payment.externalReference ?? '-'} amount=${payment.transactionAmount}`,
    );

    if (payment.status === 'approved') {
      await this.confirmApprovedPayment(payment);
      return;
    }

    if (payment.status === 'refunded' || payment.status === 'charged_back') {
      this.logger.warn(`MP payment ${payment.id} status=${payment.status} — handling refund`);
      await this.handleRefundedPayment(payment);
      return;
    }

    const flexBookingId = payment.externalReference;
    if (!flexBookingId) {
      this.logger.warn(`MP payment ${payment.id} has no external_reference — skipping status update`);
      return;
    }

    const status = this.mapMpStatus(payment.status);
    if (!status || status === FlexBookingPaymentStatus.APPROVED) {
      this.logger.log(`MP payment ${payment.id} status=${payment.status} — no DB update needed`);
      return;
    }

    const updated = await this.prisma.flexBookingPayment.updateMany({
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
    this.logger.log(
      `MP payment ${payment.id} updated ${updated.count} pending record(s) to status=${status}`,
    );
  }

  private async syncBookingPayments(flexBookingId: string, input: SyncPublicPaymentInput = {}) {
    this.logger.log(
      `Sync booking payments flexBookingId=${flexBookingId} `
      + `paymentId=${input.paymentId ?? '-'} merchantOrderId=${input.merchantOrderId ?? '-'}`,
    );

    const paymentIds = new Set<string>();
    if (input.paymentId) paymentIds.add(input.paymentId);

    if (input.merchantOrderId) {
      const order = await this.mercadoPago.getMerchantOrderContext(input.merchantOrderId);
      order.paymentIds.forEach((id) => paymentIds.add(id));
      this.logger.log(
        `Sync via merchant order ${input.merchantOrderId} paymentIds=[${order.paymentIds.join(',')}] `
        + `externalReference=${order.externalReference ?? '-'}`,
      );
      if (paymentIds.size === 0 && order.externalReference) {
        const found = await this.mercadoPago.searchPaymentsByExternalReference(order.externalReference);
        this.logger.log(`Sync search by externalReference=${order.externalReference} found=${found.length}`);
        for (const payment of found) {
          await this.processPaymentNotification(payment.id);
        }
        return;
      }
    }

    if (paymentIds.size === 0) {
      const found = await this.mercadoPago.searchPaymentsByExternalReference(flexBookingId);
      this.logger.log(`Sync search by flexBookingId=${flexBookingId} found=${found.length}`);
      for (const payment of found) {
        await this.processPaymentNotification(payment.id);
      }
      return;
    }

    for (const paymentId of paymentIds) {
      await this.processPaymentNotification(paymentId);
    }
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
      this.logger.log(`MP payment ${payment.id} — booking ${flexBookingId} already CONFIRMED`);
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

    this.logger.log(
      `Booking confirmed flexBookingId=${flexBookingId} mpPaymentId=${payment.id} `
      + `amount=${payment.transactionAmount}`,
    );

    const confirmed = await this.prisma.flexBooking.findFirst({
      where: { id: flexBookingId, deletedAt: null },
      include: { propertyFlex: { select: { name: true } } },
    });
    if (confirmed?.clientEmail?.trim()) {
      this.emailService.sendFlexReservationConfirmedEmail(
        confirmed.clientEmail.trim(),
        confirmed.clientName,
        confirmed.propertyFlex.name,
      ).catch((err) =>
        this.logger.error(`sendFlexReservationConfirmedEmail failed for ${flexBookingId}`, err),
      );
    }
  }

  private async handleRefundedPayment(payment: {
    id: string;
    externalReference: string | null;
  }) {
    const flexBookingId = payment.externalReference;
    if (!flexBookingId) return;

    await this.prisma.flexBookingPayment.updateMany({
      where: { mpPaymentId: payment.id },
      data: { status: FlexBookingPaymentStatus.REFUNDED },
    });

    this.logger.warn(
      `MP payment ${payment.id} refunded/charged back for flex booking ${flexBookingId} — manual review required`,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapMpStatus(status: string): FlexBookingPaymentStatus | null {
    switch (status) {
      case 'rejected':
        return FlexBookingPaymentStatus.REJECTED;
      case 'cancelled':
        return FlexBookingPaymentStatus.CANCELLED;
      case 'refunded':
      case 'charged_back':
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
