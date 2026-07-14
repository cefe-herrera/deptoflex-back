import { Global, Module } from '@nestjs/common';
import { AmbassadorAccessService } from './ambassador-access.service';

@Global()
@Module({
  providers: [AmbassadorAccessService],
  exports: [AmbassadorAccessService],
})
export class AmbassadorAccessModule {}
