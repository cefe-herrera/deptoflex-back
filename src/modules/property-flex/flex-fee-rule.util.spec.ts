import { FlexFeeRuleMode, Prisma } from '@prisma/client';
import { computeFeeAmount } from './flex-fee-rule.util';

const rule = (mode: FlexFeeRuleMode, numerator?: number, denominator?: number, fixedAmount?: number) => ({
  mode,
  numerator: numerator != null ? new Prisma.Decimal(numerator) : null,
  denominator: denominator ?? null,
  fixedAmount: fixedAmount != null ? new Prisma.Decimal(fixedAmount) : null,
});

describe('computeFeeAmount', () => {
  it('sin regla o modo NONE → 0', () => {
    expect(computeFeeAmount(null, 300000)).toBe(0);
    expect(computeFeeAmount(rule(FlexFeeRuleMode.NONE), 300000)).toBe(0);
  });

  it('1/3 del alquiler es exacto (sin errores de porcentaje)', () => {
    expect(computeFeeAmount(rule(FlexFeeRuleMode.RENT_FRACTION, 1, 3), 300000)).toBe(100000);
  });

  it('porcentajes y múltiplos de mes', () => {
    expect(computeFeeAmount(rule(FlexFeeRuleMode.RENT_FRACTION, 70, 100), 300000)).toBe(210000);
    expect(computeFeeAmount(rule(FlexFeeRuleMode.RENT_FRACTION, 2, 1), 300000)).toBe(600000);
  });

  it('monto fijo ignora el alquiler', () => {
    expect(computeFeeAmount(rule(FlexFeeRuleMode.FIXED, undefined, undefined, 150000), 999)).toBe(150000);
  });
});
