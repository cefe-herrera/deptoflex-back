import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AmbassadorAccessService } from '../../common/services/ambassador-access.service';
import { AuditService } from '../../common/services/audit.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

export const PLATFORM_SETTING_KEYS = {
  BOOKINGS_REQUIRE_APPROVED_AMBASSADOR: 'bookings.requireApprovedAmbassador',
  UI_SUPPORT_BUTTON_VISIBLE: 'ui.supportButtonVisible',
  UI_ASSISTANT_CHAT_VISIBLE: 'ui.assistantChatVisible',
} as const;

/** Elementos de la interfaz que el admin puede mostrar u ocultar. */
export interface UiVisibility {
  /** Botón "Soporte Koli" (WhatsApp) del menú lateral. */
  supportButton: boolean;
  /** Chat del asistente (botón flotante y panel). */
  assistantChat: boolean;
}

/** Valores cuando el admin todavía no tocó nada: Koli oculto, chat del asistente visible. */
export const UI_VISIBILITY_DEFAULTS: UiVisibility = {
  supportButton: false,
  assistantChat: true,
};

const UI_VISIBILITY_KEYS: Record<keyof UiVisibility, string> = {
  supportButton: PLATFORM_SETTING_KEYS.UI_SUPPORT_BUTTON_VISIBLE,
  assistantChat: PLATFORM_SETTING_KEYS.UI_ASSISTANT_CHAT_VISIBLE,
};

export interface BookingPolicy {
  requireApprovedAmbassador: boolean;
  /** `env` = default de BOOKINGS_REQUIRE_APPROVED_AMBASSADOR; `admin` = sobreescrito desde el panel. */
  source: 'env' | 'admin';
  envDefault: boolean;
  updatedAt: Date | null;
  updatedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

const STAFF_ROLES = ['ADMIN', 'OPERATOR'];

@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ambassadorAccess: AmbassadorAccessService,
    private readonly audit: AuditService,
  ) {}

  private get envRequireApprovedAmbassador(): boolean {
    return (
      this.config.get<boolean>('app.bookingsRequireApprovedAmbassador') ?? false
    );
  }

  async getBookingPolicy(): Promise<BookingPolicy> {
    const envDefault = this.envRequireApprovedAmbassador;
    const row = await this.prisma.platformSetting.findUnique({
      where: {
        key: PLATFORM_SETTING_KEYS.BOOKINGS_REQUIRE_APPROVED_AMBASSADOR,
      },
      include: {
        updatedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!row || typeof row.value !== 'boolean') {
      return {
        requireApprovedAmbassador: envDefault,
        source: 'env',
        envDefault,
        updatedAt: null,
        updatedBy: null,
      };
    }

    return {
      requireApprovedAmbassador: row.value,
      source: 'admin',
      envDefault,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }

  /** `null` borra el override y vuelve al default del env. */
  async setBookingPolicy(
    requireApprovedAmbassador: boolean | null,
    actorId: string,
  ): Promise<BookingPolicy> {
    const key = PLATFORM_SETTING_KEYS.BOOKINGS_REQUIRE_APPROVED_AMBASSADOR;
    const previous = await this.getBookingPolicy();

    if (requireApprovedAmbassador === null) {
      await this.prisma.platformSetting.deleteMany({ where: { key } });
    } else {
      await this.prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: requireApprovedAmbassador, updatedById: actorId },
        update: { value: requireApprovedAmbassador, updatedById: actorId },
      });
    }

    const next = await this.getBookingPolicy();
    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: key,
      action: 'PLATFORM_SETTING_UPDATED',
      metadata: {
        from: {
          value: previous.requireApprovedAmbassador,
          source: previous.source,
        },
        to: { value: next.requireApprovedAmbassador, source: next.source },
      },
    });
    return next;
  }

  /** Visibilidad de elementos de la interfaz (lo guardado por el admin, o el default). */
  async getUiVisibility(): Promise<UiVisibility> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(UI_VISIBILITY_KEYS) } },
      select: { key: true, value: true },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const read = (field: keyof UiVisibility) => {
      const v = byKey.get(UI_VISIBILITY_KEYS[field]);
      return typeof v === 'boolean' ? v : UI_VISIBILITY_DEFAULTS[field];
    };
    return {
      supportButton: read('supportButton'),
      assistantChat: read('assistantChat'),
    };
  }

  /** Actualiza solo los campos enviados y deja registro en la auditoría. */
  async setUiVisibility(
    changes: Partial<UiVisibility>,
    actorId: string,
  ): Promise<UiVisibility> {
    const previous = await this.getUiVisibility();
    const fields = (
      Object.keys(UI_VISIBILITY_KEYS) as (keyof UiVisibility)[]
    ).filter((f) => typeof changes[f] === 'boolean');
    if (!fields.length) return previous;

    await this.prisma.$transaction(
      fields.map((f) => {
        const key = UI_VISIBILITY_KEYS[f];
        const value = changes[f] as boolean;
        return this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value, updatedById: actorId },
          update: { value, updatedById: actorId },
        });
      }),
    );

    const next = await this.getUiVisibility();
    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: 'ui.visibility',
      action: 'PLATFORM_SETTING_UPDATED',
      metadata: { from: { ...previous }, to: { ...next } },
    });
    return next;
  }

  /** Estado para el usuario actual: el front lo usa para ocultar/avisar antes de iniciar el flujo. */
  async getBookingAccess(user?: CurrentUserPayload) {
    const { requireApprovedAmbassador } = await this.getBookingPolicy();
    try {
      await this.assertAllowed(requireApprovedAmbassador, user);
      return {
        requireApprovedAmbassador,
        canCreateBookings: true,
        reason: null,
      };
    } catch (err) {
      if (
        err instanceof ForbiddenException ||
        err instanceof UnauthorizedException
      ) {
        return {
          requireApprovedAmbassador,
          canCreateBookings: false,
          reason: err.message,
        };
      }
      throw err;
    }
  }

  /**
   * Gate para iniciar reservas (prepare / reservation-intents). Con la política
   * activa, solo staff o embajadores aprobados pueden reservar.
   */
  async assertCanCreateBookings(user?: CurrentUserPayload): Promise<void> {
    const { requireApprovedAmbassador } = await this.getBookingPolicy();
    await this.assertAllowed(requireApprovedAmbassador, user);
  }

  private async assertAllowed(
    requireApprovedAmbassador: boolean,
    user?: CurrentUserPayload,
  ): Promise<void> {
    if (!requireApprovedAmbassador) return;
    if (!user) throw new UnauthorizedException('Iniciá sesión para reservar');
    if (user.roles?.some((r) => STAFF_ROLES.includes(r))) return;

    try {
      await this.ambassadorAccess.assertCanOperateAsAmbassador(user.id);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw new ForbiddenException(
          'Solo los embajadores aprobados pueden realizar reservas',
        );
      }
      throw err;
    }
  }
}
