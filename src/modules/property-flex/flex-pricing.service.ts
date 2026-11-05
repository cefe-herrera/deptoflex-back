import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FlexFeeRuleKind, Prisma, PropertyFlexPricingPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlexFeeRulesService } from './flex-fee-rules.service';
import { computeFeeAmount } from './flex-fee-rule.util';
import { CreatePricingPlanDto } from './dto/create-pricing-plan.dto';
import { UpdatePricingPlanDto } from './dto/update-pricing-plan.dto';

export interface FlexPricingQuote {
  pricingPlanId: string | null;
  planCode: string | null;
  planLabel: string | null;
  totalMonths: number;
  monthlyRent: number;
  totalAmount: number;
  depositAmount: number;
  entryCommissionAmount: number;
  reservationPaymentAmount: number;
  currency: string;
  rentIncludesExpenses: boolean;
  rentIncludesUtilities: boolean;
  includesLinens: boolean;
  conditionsText: string | null;
  usingLegacyPricing: boolean;
}

const PLAN_INCLUDE = { depositRule: true, entryCommissionRule: true } satisfies Prisma.PropertyFlexPricingPlanInclude;

export type PricingPlanWithRules = Prisma.PropertyFlexPricingPlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

@Injectable()
export class FlexPricingService {
  constructor(
    private prisma: PrismaService,
    private feeRules: FlexFeeRulesService,
  ) {}

  async listPlans(propertyFlexId: string, activeOnly = false): Promise<PricingPlanWithRules[]> {
    await this.ensureProperty(propertyFlexId);
    return this.prisma.propertyFlexPricingPlan.findMany({
      where: { propertyFlexId, ...(activeOnly && { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }],
      include: PLAN_INCLUDE,
    });
  }

  async createPlan(propertyFlexId: string, dto: CreatePricingPlanDto) {
    await this.ensureProperty(propertyFlexId);
    this.validateMonthsRange(dto.minMonths, dto.maxMonths);
    const depositRuleId = await this.feeRules.resolveRuleId(FlexFeeRuleKind.DEPOSIT, dto.depositRuleId);
    const entryCommissionRuleId = await this.feeRules.resolveRuleId(
      FlexFeeRuleKind.ENTRY_COMMISSION,
      dto.entryCommissionRuleId,
    );

    const plan = await this.prisma.propertyFlexPricingPlan.create({
      data: {
        propertyFlexId,
        code: dto.code,
        label: dto.label,
        minMonths: dto.minMonths,
        maxMonths: dto.maxMonths ?? null,
        monthlyRent: String(dto.monthlyRent),
        currency: dto.currency ?? 'ARS',
        rentIncludesExpenses: dto.rentIncludesExpenses ?? false,
        rentIncludesUtilities: dto.rentIncludesUtilities ?? false,
        includesLinens: dto.includesLinens ?? false,
        depositRuleId,
        entryCommissionRuleId,
        conditionsText: dto.conditionsText ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: PLAN_INCLUDE,
    });

    await this.syncPropertyPriceFromPlans(propertyFlexId);
    return plan;
  }

  async updatePlan(propertyFlexId: string, planId: string, dto: UpdatePricingPlanDto) {
    await this.getPlan(propertyFlexId, planId);
    if (dto.minMonths != null || dto.maxMonths !== undefined) {
      const existing = await this.prisma.propertyFlexPricingPlan.findUniqueOrThrow({ where: { id: planId } });
      this.validateMonthsRange(dto.minMonths ?? existing.minMonths, dto.maxMonths ?? existing.maxMonths ?? undefined);
    }
    // En update, undefined = no tocar (no aplicar la regla por defecto).
    const depositRuleId = dto.depositRuleId !== undefined
      ? await this.feeRules.resolveRuleId(FlexFeeRuleKind.DEPOSIT, dto.depositRuleId)
      : undefined;
    const entryCommissionRuleId = dto.entryCommissionRuleId !== undefined
      ? await this.feeRules.resolveRuleId(FlexFeeRuleKind.ENTRY_COMMISSION, dto.entryCommissionRuleId)
      : undefined;

    const plan = await this.prisma.propertyFlexPricingPlan.update({
      where: { id: planId },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.label && { label: dto.label }),
        ...(dto.minMonths != null && { minMonths: dto.minMonths }),
        ...(dto.maxMonths !== undefined && { maxMonths: dto.maxMonths ?? null }),
        ...(dto.monthlyRent != null && { monthlyRent: String(dto.monthlyRent) }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.rentIncludesExpenses !== undefined && { rentIncludesExpenses: dto.rentIncludesExpenses }),
        ...(dto.rentIncludesUtilities !== undefined && { rentIncludesUtilities: dto.rentIncludesUtilities }),
        ...(dto.includesLinens !== undefined && { includesLinens: dto.includesLinens }),
        ...(depositRuleId !== undefined && { depositRuleId }),
        ...(entryCommissionRuleId !== undefined && { entryCommissionRuleId }),
        ...(dto.conditionsText !== undefined && { conditionsText: dto.conditionsText || null }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: PLAN_INCLUDE,
    });

    await this.syncPropertyPriceFromPlans(propertyFlexId);
    return plan;
  }

  async deletePlan(propertyFlexId: string, planId: string) {
    await this.getPlan(propertyFlexId, planId);
    await this.prisma.propertyFlexPricingPlan.delete({ where: { id: planId } });
    await this.syncPropertyPriceFromPlans(propertyFlexId);
    return { message: 'Plan deleted' };
  }

  async quote(
    propertyFlexId: string,
    totalMonths: number,
    pricingPlanId?: string,
  ): Promise<FlexPricingQuote> {
    const property = await this.ensureProperty(propertyFlexId);
    const plans = await this.listPlans(propertyFlexId, true);

    if (plans.length === 0) {
      const monthlyRent = Number(property.monthlyRate);
      const totalAmount = monthlyRent * totalMonths;
      const depositAmount = property.depositAmount != null
        ? Number(property.depositAmount)
        : Math.round((monthlyRent / 3) * 100) / 100;
      const reservationPaymentAmount = this.reservationPaymentFromProperty(property);

      return {
        pricingPlanId: null,
        planCode: null,
        planLabel: null,
        totalMonths,
        monthlyRent,
        totalAmount,
        depositAmount,
        entryCommissionAmount: 0,
        reservationPaymentAmount,
        currency: property.currency,
        rentIncludesExpenses: false,
        rentIncludesUtilities: false,
        includesLinens: false,
        conditionsText: null,
        usingLegacyPricing: true,
      };
    }

    const plan = this.resolvePlan(plans, totalMonths, pricingPlanId);
    if (!plan) {
      throw new BadRequestException(
        `No hay un plan de precios activo para ${totalMonths} ${totalMonths === 1 ? 'mes' : 'meses'}`,
      );
    }

    const monthlyRent = Number(plan.monthlyRent);
    const depositAmount = computeFeeAmount(plan.depositRule, monthlyRent);
    const entryCommissionAmount = computeFeeAmount(plan.entryCommissionRule, monthlyRent);
    const reservationPaymentAmount = this.reservationPaymentFromProperty(property);

    return {
      pricingPlanId: plan.id,
      planCode: plan.code,
      planLabel: plan.label,
      totalMonths,
      monthlyRent,
      totalAmount: monthlyRent * totalMonths,
      depositAmount,
      entryCommissionAmount,
      reservationPaymentAmount,
      currency: plan.currency,
      rentIncludesExpenses: plan.rentIncludesExpenses,
      rentIncludesUtilities: plan.rentIncludesUtilities,
      includesLinens: plan.includesLinens,
      conditionsText: plan.conditionsText,
      usingLegacyPricing: false,
    };
  }

  resolvePlan<T extends PropertyFlexPricingPlan>(
    plans: T[],
    totalMonths: number,
    pricingPlanId?: string,
  ): T | null {
    if (pricingPlanId) {
      const byId = plans.find((p) => p.id === pricingPlanId && p.isActive);
      if (!byId) return null;
      if (!this.monthsFitPlan(totalMonths, byId)) return null;
      return byId;
    }

    const matches = plans
      .filter((p) => p.isActive && this.monthsFitPlan(totalMonths, p))
      .sort((a, b) => b.minMonths - a.minMonths);

    return matches[0] ?? null;
  }

  monthsFitPlan(totalMonths: number, plan: Pick<PropertyFlexPricingPlan, 'minMonths' | 'maxMonths'>): boolean {
    if (totalMonths < plan.minMonths) return false;
    if (plan.maxMonths != null && totalMonths > plan.maxMonths) return false;
    return true;
  }

  reservationPaymentFromProperty(property: { reservationPaymentAmount?: unknown | null }): number {
    if (property.reservationPaymentAmount == null) return 0;
    const amount = Number(property.reservationPaymentAmount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  private async syncPropertyPriceFromPlans(propertyFlexId: string) {
    const plans = await this.listPlans(propertyFlexId, true);
    if (plans.length === 0) return;

    const minRentPlan = [...plans].sort((a, b) => Number(a.monthlyRent) - Number(b.monthlyRent))[0];
    const minMonths = Math.min(...plans.map((p) => p.minMonths));

    await this.prisma.propertyFlex.update({
      where: { id: propertyFlexId },
      data: {
        monthlyRate: minRentPlan.monthlyRent,
        minMonths,
        currency: minRentPlan.currency,
      },
    });
  }

  private async ensureProperty(propertyFlexId: string) {
    const property = await this.prisma.propertyFlex.findFirst({
      where: { id: propertyFlexId, deletedAt: null },
    });
    if (!property) throw new NotFoundException('PropertyFlex not found');
    return property;
  }

  private async getPlan(propertyFlexId: string, planId: string) {
    const plan = await this.prisma.propertyFlexPricingPlan.findFirst({
      where: { id: planId, propertyFlexId },
    });
    if (!plan) throw new NotFoundException('Pricing plan not found');
    return plan;
  }

  private validateMonthsRange(minMonths: number, maxMonths?: number) {
    if (maxMonths != null && maxMonths < minMonths) {
      throw new BadRequestException('maxMonths must be greater than or equal to minMonths');
    }
  }
}
