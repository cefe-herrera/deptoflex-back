import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { MediaStatus } from '@prisma/client';

@Injectable()
export class MediaCleanupJob {
  private readonly logger = new Logger(MediaCleanupJob.name);

  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanOrphanedFiles() {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const orphans = await this.prisma.mediaFile.findMany({
      where: { status: MediaStatus.PENDING, createdAt: { lt: cutoff } },
    });

    let cleaned = 0;
    for (const file of orphans) {
      try {
        await this.r2.deleteObject(file.objectKey);
        await this.prisma.mediaFile.update({
          where: { id: file.id },
          data: { status: MediaStatus.DELETED, deletedAt: new Date() },
        });
        cleaned++;
      } catch (err) {
        this.logger.error(`Failed to cleanup ${file.objectKey}`, err);
      }
    }

    if (cleaned > 0) this.logger.log(`Cleaned ${cleaned} orphaned media files`);
  }
}
