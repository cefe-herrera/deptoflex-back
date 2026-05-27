import { Module } from '@nestjs/common';
import { PropertyFlexController } from './property-flex.controller';
import { PropertyFlexService } from './property-flex.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [PropertyFlexController],
  providers: [PropertyFlexService],
  exports: [PropertyFlexService],
})
export class PropertyFlexModule {}
