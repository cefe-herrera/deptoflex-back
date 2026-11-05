import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { FlexFeeRule, FlexFeeRuleKind, FlexFeeRuleMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlexFeeRuleDto, UpdateFlexFeeRuleDto } from './dto/flex-fee-rule.dto';

@Injectable()
export class FlexFeeRulesService {
  constructor(private prisma: PrismaService) {}

  async list(kind?: FlexFeeRuleKind, activeOnly = false) {
    const rules = await this.prisma.flexFeeRule.findMany({
      where: { ...(kind && { kind }), ...(activeOnly && { isActive: true }) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { depositPlans: true, commissionPlans: true } } },
    });
    return rules.map(({ _count, ...rule }) => ({
      ...rule,
      planCount: _count.depositPlans + _count.commissionPlans,
    }));
  }

  async create(dto: CreateFlexFeeRuleDto) {
    const values = this.normalizeValues(dto.mode, dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, dto.kind);
      return tx.flexFeeRule.create({
        data: {
          kind: dto.kind,
          name: dto.name.trim(),
          mode: dto.mode,
          ...values,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    });
  }

  async update(id: string, dto: UpdateFlexFeeRuleDto) {
    const existing = await this.get(id);
    const mode = dto.mode ?? existing.mode;
    const touchesValues = dto.mode !== undefined
      || dto.numerator !== undefined
      || dto.denominator !== undefined
      || dto.fixedAmount !== undefined;

    const values = touchesValues
      ? this.normalizeValues(mode, {
          numerator: dto.numerator ?? (existing.numerator != null ? Number(existing.numerator) : undefined),
          denominator: dto.denominator ?? existing.denominator ?? undefined,
          fixedAmount: dto.fixedAmount ?? (existing.fixedAmount != null ? Number(existing.fixedAmount) : undefined),
        })
      : {};

    if (dto.isActive === false && (dto.isDefault ?? existing.isDefault)) {
      throw new BadRequestException('No se puede desactivar la regla por defecto. Elegí otra como predeterminada primero.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, existing.kind, id);
      return tx.flexFeeRule.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.mode && { mode: dto.mode }),
          ...values,
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        },
      });
    });
  }

  async remove(id: string) {
    await this.get(id);
    const inUse = await this.prisma.propertyFlexPricingPlan.count({
      where: { OR: [{ depositRuleId: id }, { entryCommissionRuleId: id }] },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `La regla está en uso por ${inUse} plan${inUse === 1 ? '' : 'es'}. Desactivala o reasigná esos planes primero.`,
      );
    }
    await this.prisma.flexFeeRule.delete({ where: { id } });
    return { message: 'Rule deleted' };
  }

  /** Valida que el id exista y sea del tipo correcto. `undefined` → regla por defecto del tipo. */
  async resolveRuleId(kind: FlexFeeRuleKind, ruleId: string | null | undefined): Promise<string | null> {
    if (ruleId === null) return null;
    if (ruleId === undefined) {
      const def = await this.prisma.flexFeeRule.findFirst({ where: { kind, isDefault: true, isActive: true } });
      return def?.id ?? null;
    }
    const rule = await this.prisma.flexFeeRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.kind !== kind) {
      throw new BadRequestException(
        kind === FlexFeeRuleKind.DEPOSIT ? 'Regla de depósito inválida' : 'Regla de comisión inválida',
      );
    }
    return rule.id;
  }

  private async get(id: string): Promise<FlexFeeRule> {
    const rule = await this.prisma.flexFeeRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Fee rule not found');
    return rule;
  }

  private clearDefault(tx: Prisma.TransactionClient, kind: FlexFeeRuleKind, exceptId?: string) {
    return tx.flexFeeRule.updateMany({
      where: { kind, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
      data: { isDefault: false },
    });
  }

  /** Deja solo los campos que usa el modo y valida que estén. */
  private normalizeValues(
    mode: FlexFeeRuleMode,
    v: { numerator?: number; denominator?: number; fixedAmount?: number },
  ) {
    switch (mode) {
      case FlexFeeRuleMode.RENT_FRACTION:
        if (v.numerator == null || v.numerator <= 0) {
          throw new BadRequestException('La proporción del alquiler debe ser mayor a 0');
        }
        return {
          numerator: String(v.numerator),
          denominator: v.denominator ?? 1,
          fixedAmount: null,
        };
      case FlexFeeRuleMode.FIXED:
        if (v.fixedAmount == null) throw new BadRequestException('Falta el monto fijo');
        return { numerator: null, denominator: null, fixedAmount: String(v.fixedAmount) };
      default:
        return { numerator: null, denominator: null, fixedAmount: null };
    }
  }
}
