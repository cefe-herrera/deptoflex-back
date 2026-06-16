import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface AuditLogInput {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(input: AuditLogInput) {
    return this.prisma.activityLog.create({
      data: {
        userId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  }

  findForEntity(entityType: string, entityId: string, actions?: string[]) {
    return this.prisma.activityLog.findMany({
      where: {
        entityType,
        entityId,
        ...(actions?.length ? { action: { in: actions } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
