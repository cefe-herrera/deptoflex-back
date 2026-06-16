import { Module } from '@nestjs/common';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';
import { PropertyFlexModule } from '../property-flex/property-flex.module';

@Module({
  imports: [PropertyFlexModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
