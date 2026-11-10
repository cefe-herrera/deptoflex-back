import { applyDecorators, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ApiHeader,
  ApiSecurity,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiUsageInterceptor } from './api-usage.interceptor';

export const API_KEY_SECURITY = 'api-key';

/**
 * Marca un controller/handler como autenticado por API key de tercero.
 * `@Public()` desactiva el JWT/roles globales; `ApiKeyGuard` hace la
 * autenticación real y `ApiUsageInterceptor` registra el consumo.
 */
export const ApiKeyAuth = () =>
  applyDecorators(
    Public(),
    UseGuards(ApiKeyGuard),
    UseInterceptors(ApiUsageInterceptor),
    ApiSecurity(API_KEY_SECURITY),
    ApiHeader({
      name: 'X-Api-Key',
      required: true,
      description: 'API key del cliente (dfx_...)',
    }),
    ApiUnauthorizedResponse({
      description: 'Falta la API key o es inválida/revocada',
    }),
    ApiTooManyRequestsResponse({
      description: 'Límite de requests por minuto excedido',
    }),
  );
