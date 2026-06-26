import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { CommissionRatesService } from './commission-rates.service';
import { CommissionWorkflowService } from './commission-workflow.service';
import { CommissionSettlementsService } from './commission-settlements.service';

@Module({
    controllers: [CommissionsController],
    providers: [
        CommissionsService,
        CommissionRatesService,
        CommissionWorkflowService,
        CommissionSettlementsService,
    ],
    exports: [
        CommissionsService,
        CommissionRatesService,
        CommissionWorkflowService,
        CommissionSettlementsService,
    ],
})
export class CommissionsModule { }
