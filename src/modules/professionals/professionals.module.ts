import { Module } from '@nestjs/common';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';
import { AgencyTeamService } from './agency-team.service';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [MediaModule, CommissionsModule, AuthModule, EmailModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService, AgencyTeamService],
  exports: [ProfessionalsService, AgencyTeamService],
})
export class ProfessionalsModule {}
