import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FlexDepositRule,
  FlexEntryCommissionRule,
  PropertyFlexPricingPlan,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class FlexPricingService {
  constructor(private prisma: PrismaService) {}

  async listPlans(propertyFlexId: string, activeOnly = false) {
    await this.ensureProperty(propertyFlexId);
    return this.prisma.propertyFlexPricingPlan.findMany({
      where: { propertyFlexId, ...(activeOnly && { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { minMonths: 'asc' }],
    });
  }

  async createPlan(propertyFlexId: string, dto: CreatePricingPlanDto) {
    await this.ensureProperty(propertyFlexId);
    this.validateMonthsRange(dto.minMonths, dto.maxMonths);

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
        depositRule: dto.depositRule ?? FlexDepositRule.THIRD_OF_MONTH,
        ...(dto.customDepositAmount != null && { customDepositAmount: String(dto.customDepositAmount) }),
        entryCommissionRule: dto.entryCommissionRule ?? FlexEntryCommissionRule.NONE,
        conditionsText: dto.conditionsText ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
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
        ...(dto.depositRule && { depositRule: dto.depositRule }),
        ...(dto.customDepositAmount !== undefined && {
          customDepositAmount: dto.customDepositAmount != null ? String(dto.customDepositAmount) : null,
        }),
        ...(dto.entryCommissionRule && { entryCommissionRule: dto.entryCommissionRule }),
        ...(dto.conditionsText !== undefined && { conditionsText: dto.conditionsText || null }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
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
        : this.calculateDepositAmount(monthlyRent, FlexDepositRule.THIRD_OF_MONTH, null);
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
    const depositAmount = this.calculateDepositAmount(
      monthlyRent,
      plan.depositRule,
      plan.customDepositAmount != null ? Number(plan.customDepositAmount) : null,
    );
    const entryCommissionAmount = this.calculateEntryCommission(monthlyRent, plan.entryCommissionRule);
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

  resolvePlan(
    plans: PropertyFlexPricingPlan[],
    totalMonths: number,
    pricingPlanId?: string,
  ): PropertyFlexPricingPlan | null {
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

  calculateDepositAmount(
    monthlyRent: number,
    rule: FlexDepositRule,
    customAmount: number | null,
  ): number {
    if (rule === FlexDepositRule.CUSTOM && customAmount != null) return customAmount;
    if (rule === FlexDepositRule.ONE_MONTH_RENT) return monthlyRent;
    return Math.round((monthlyRent / 3) * 100) / 100;
  }

  calculateEntryCommission(monthlyRent: number, rule: FlexEntryCommissionRule): number {
    switch (rule) {
      case FlexEntryCommissionRule.THIRD_FIRST_MONTH:
        return Math.round((monthlyRent / 3) * 100) / 100;
      case FlexEntryCommissionRule.HALF_FIRST_MONTH:
        return Math.round((monthlyRent / 2) * 100) / 100;
      case FlexEntryCommissionRule.SEVENTY_FIRST_MONTH:
        return Math.round(monthlyRent * 0.7 * 100) / 100;
      case FlexEntryCommissionRule.FULL_FIRST_MONTH:
        return monthlyRent;
      default:
        return 0;
    }
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
