import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { FlexBookingPaymentsService } from './flex-booking-payments.service';

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
  handleMercadoPago(@Query() query: Record<string, string | undefined>) {
    return this.payments.handleWebhook(query);
  }
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
}
