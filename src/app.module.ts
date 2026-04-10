import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import r2Config from './config/r2.config';
import emailConfig from './config/email.config';
import { validationSchema } from './config/validation.schema';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { UnitsModule } from './modules/units/units.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { LeadsModule } from './modules/leads/leads.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { MediaModule } from './modules/media/media.module';
import { R2Module } from './modules/r2/r2.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, r2Config, emailConfig],
      validationSchema,
      validationOptions: { abortEarly: true },
    }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 5 },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    R2Module,
    AuthModule,
    UsersModule,
    RolesModule,
    ProfessionalsModule,
    PropertiesModule,
    UnitsModule,
    AmenitiesModule,
    LeadsModule,
    BookingsModule,
    CommissionsModule,
    MediaModule,
    HealthModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule { }
