import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { CommissionRatesService } from './commission-rates.service';

@Module({
    controllers: [CommissionsController],
    providers: [CommissionsService, CommissionRatesService],
    exports: [CommissionsService, CommissionRatesService],
})
export class CommissionsModule { }
