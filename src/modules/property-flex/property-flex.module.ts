import { Module } from '@nestjs/common';
import { PropertyFlexController } from './property-flex.controller';
import { PropertyFlexService } from './property-flex.service';
import { FlexPricingService } from './flex-pricing.service';
import { FlexFeeRulesService } from './flex-fee-rules.service';
import { FlexFeeRulesController } from './flex-fee-rules.controller';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [MediaModule, CommissionsModule],
  controllers: [PropertyFlexController, FlexFeeRulesController],
  providers: [PropertyFlexService, FlexPricingService, FlexFeeRulesService],
  exports: [PropertyFlexService, FlexPricingService, FlexFeeRulesService],
})
export class PropertyFlexModule {}
