import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuth } from './api-key-auth.decorator';
import { PartnerApiService } from './partner-api.service';
import { PartnerAvailabilityQueryDto } from './dto/partner-availability-query.dto';
import type { PartnerRequest } from './partner-api.types';

@ApiTags('Partner API')
@ApiKeyAuth()
@Controller('partner')
export class PartnerApiController {
  constructor(private readonly partner: PartnerApiService) {}

  @Get('properties')
  @ApiOperation({
    summary: 'Listar propiedades temporales disponibles para consulta',
    description:
      'Devuelve las propiedades activas cuya disponibilidad se puede consultar por API.',
  })
  listProperties() {
    return this.partner.listProperties();
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Consultar disponibilidad y tarifas',
    description:
      'Disponibilidad y tarifas por tipo de habitación para un rango de fechas. Las respuestas pueden venir de caché (5-15 min). Si el proveedor no responde se sirven los últimos datos conocidos con `stale: true`.',
  })
  availability(
    @Query() query: PartnerAvailabilityQueryDto,
    @Req() req: PartnerRequest,
  ) {
    req.apiUsage = {};
    return this.partner.availability(
      query,
      { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      req.apiUsage,
    );
  }
}
