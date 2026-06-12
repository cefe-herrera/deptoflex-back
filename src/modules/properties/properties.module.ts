import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { MediaModule } from '../media/media.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [MediaModule, CommissionsModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
