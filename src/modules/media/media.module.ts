import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaCleanupJob } from './media-cleanup.job';

@Module({
  providers: [MediaService, MediaCleanupJob],
  exports: [MediaService],
})
export class MediaModule {}
