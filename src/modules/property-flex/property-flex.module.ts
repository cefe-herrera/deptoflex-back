import { Module } from '@nestjs/common';
import { PropertyFlexController } from './property-flex.controller';
import { PropertyFlexService } from './property-flex.service';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [MediaModule, CommissionsModule],
  controllers: [PropertyFlexController],
  providers: [PropertyFlexService],
  exports: [PropertyFlexService],
})
export class PropertyFlexModule {}
