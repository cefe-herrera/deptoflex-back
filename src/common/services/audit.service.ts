import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../modules/prisma/prisma.service';

export interface AuditLogInput {
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Registra un evento de auditoría. Nunca debe romper el flujo principal:
   * si falla la escritura del log, se registra en el logger de la app y se
   * sigue de largo (mejor perder una línea de trazabilidad que la operación
   * real del usuario).
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: input.actorId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
        },
      });
    } catch (err) {
      this.logger.error(
        `No se pudo registrar audit log entityType=${input.entityType} entityId=${input.entityId} action=${input.action}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
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
