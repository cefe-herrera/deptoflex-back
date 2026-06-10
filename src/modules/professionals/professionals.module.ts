import { Module } from '@nestjs/common';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [MediaModule, CommissionsModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
