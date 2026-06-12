import { Module } from '@nestjs/common';
import { PropertyFlexController } from './property-flex.controller';
import { PropertyFlexService } from './property-flex.service';
import { FlexPricingService } from './flex-pricing.service';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [MediaModule, CommissionsModule],
  controllers: [PropertyFlexController],
  providers: [PropertyFlexService, FlexPricingService],
  exports: [PropertyFlexService, FlexPricingService],
})
export class PropertyFlexModule {}
