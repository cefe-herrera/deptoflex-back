import {
  Body,
  Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { FlexBookingPaymentsService } from './flex-booking-payments.service';

class SyncPublicPaymentDto {
  paymentId?: string;
  merchantOrderId?: string;
}

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(ThrottlerGuard)
export class PaymentsWebhookController {
  constructor(private payments: FlexBookingPaymentsService) {}

  @Public()
  @Get('mercadopago')
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Webhook de Mercado Pago (público)' })
  handleMercadoPago(
    @Query() query: Record<string, string | undefined>,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const event = extractDataId(query, body);
    return this.payments.handleWebhook(query, body, {
      xSignature: typeof xSignature === 'string' ? xSignature : xSignature?.[0],
      xRequestId: typeof xRequestId === 'string' ? xRequestId : xRequestId?.[0],
      dataId: event,
    });
  }
}

function extractDataId(
  query: Record<string, string | undefined>,
  body: unknown,
): string | undefined {
  if (query['data.id']) return query['data.id'];
  if (query.id) return query.id;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (record.data && typeof record.data === 'object') {
      const data = record.data as Record<string, unknown>;
      if (data.id != null) return String(data.id);
    }
  }
  return undefined;
}

@ApiTags('Public Flex Payments')
@Controller('public/flex-bookings/pay')
@UseGuards(ThrottlerGuard)
export class PublicFlexPaymentsController {
  constructor(private payments: FlexBookingPaymentsService) {}

  @Public()
  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Detalle público de reserva para pago (sin auth)' })
  @ApiParam({ name: 'token', description: 'Token de pago de la reserva' })
  getPaymentPage(@Param('token') token: string) {
    return this.payments.getPublicPaymentPage(token);
  }

  @Public()
  @Post(':token/checkout')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generar checkout Mercado Pago para huésped (sin auth)' })
  @ApiParam({ name: 'token', description: 'Token de pago de la reserva' })
  createCheckout(@Param('token') token: string) {
    return this.payments.createPublicCheckout(token);
  }

  @Public()
  @Post(':token/sync')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Sincronizar estado de pago con Mercado Pago (fallback al volver del checkout)',
  })
  @ApiParam({ name: 'token', description: 'Token de pago de la reserva' })
  syncPayment(
    @Param('token') token: string,
    @Body() dto: SyncPublicPaymentDto,
  ) {
    return this.payments.syncPublicPayment(token, {
      paymentId: dto.paymentId,
      merchantOrderId: dto.merchantOrderId,
    });
  }
}
