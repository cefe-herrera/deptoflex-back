import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { AmbassadorsController } from './ambassadors.controller';
import { AmbassadorsService } from './ambassadors.service';

/**
 * Tracking de reservas de embajador hechas en el motor público de Cloudbeds.
 *
 * Esta integración NO usa la API oficial de Cloudbeds: el embajador abre el motor
 * con parámetros en la URL y un script inyectado nos avisa de la reserva. La
 * atribución resultante queda como PENDING / PENDING_VALIDATION (ver service).
 */
@Module({
  imports: [PrismaModule, CommissionsModule],
  controllers: [AmbassadorsController],
  providers: [AmbassadorsService],
})
export class AmbassadorsModule {}
