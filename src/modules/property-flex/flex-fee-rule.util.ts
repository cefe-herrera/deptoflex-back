import { FlexFeeRule, FlexFeeRuleMode } from '@prisma/client';

export type FeeRuleCalcFields = Pick<FlexFeeRule, 'mode' | 'numerator' | 'denominator' | 'fixedAmount'>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Monto que resulta de aplicar una regla a un alquiler mensual. Sin regla → 0. */
export function computeFeeAmount(rule: FeeRuleCalcFields | null | undefined, monthlyRent: number): number {
  if (!rule) return 0;
  switch (rule.mode) {
    case FlexFeeRuleMode.FIXED:
      return rule.fixedAmount != null ? round2(Number(rule.fixedAmount)) : 0;
    case FlexFeeRuleMode.RENT_FRACTION: {
      const num = rule.numerator != null ? Number(rule.numerator) : 0;
      const den = rule.denominator && rule.denominator > 0 ? rule.denominator : 1;
      return round2((monthlyRent * num) / den);
    }
    default:
      return 0;
  }
}
