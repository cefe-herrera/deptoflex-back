import { Module } from '@nestjs/common';
import { CloudbedsModule } from '../cloudbeds/cloudbeds.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PartnerApiController } from './partner-api.controller';
import { AdminApiClientsController } from './admin-api-clients.controller';
import { ApiPortalController } from './api-portal.controller';
import { ApiInvitationsController } from './api-invitations.controller';
import { ApiOrganizationService } from './api-organization.service';
import { PartnerBookingsService } from './partner-bookings.service';
import { AdminPartnerBookingsController } from './admin-partner-bookings.controller';
import { PartnerApiService } from './partner-api.service';
import { ApiClientsService } from './api-clients.service';
import { ApiKeysService } from './api-keys.service';
import { ApiRateLimiterService } from './api-rate-limiter.service';
import { ApiUsageService } from './api-usage.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiUsageInterceptor } from './api-usage.interceptor';

/**
 * Partner API: acceso de terceros por API key a la disponibilidad de
 * propiedades temporales (Cloudbeds), con rate limit y métricas de uso.
 */
@Module({
  imports: [CloudbedsModule, AuthModule, EmailModule, NotificationsModule],
  controllers: [
    PartnerApiController,
    AdminApiClientsController,
    ApiPortalController,
    ApiInvitationsController,
    AdminPartnerBookingsController,
  ],
  providers: [
    PartnerApiService,
    ApiClientsService,
    ApiOrganizationService,
    PartnerBookingsService,
    ApiKeysService,
    ApiRateLimiterService,
    ApiUsageService,
    ApiKeyGuard,
    ApiUsageInterceptor,
  ],
})
export class PartnerApiModule {}
