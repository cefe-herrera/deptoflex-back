-- Catálogo global de reglas de depósito / comisión de ingreso.
-- Reemplaza los enums FlexDepositRule / FlexEntryCommissionRule por filas configurables.

-- CreateEnum
CREATE TYPE "FlexFeeRuleKind" AS ENUM ('DEPOSIT', 'ENTRY_COMMISSION');

-- CreateEnum
CREATE TYPE "FlexFeeRuleMode" AS ENUM ('NONE', 'RENT_FRACTION', 'FIXED');

-- CreateTable
CREATE TABLE "flex_fee_rules" (
    "id" UUID NOT NULL,
    "kind" "FlexFeeRuleKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "mode" "FlexFeeRuleMode" NOT NULL,
    "numerator" DECIMAL(10,4),
    "denominator" SMALLINT,
    "fixed_amount" DECIMAL(12,2),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flex_fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flex_fee_rules_kind_is_active_idx" ON "flex_fee_rules"("kind", "is_active");

-- Reglas equivalentes a los valores de los enums anteriores
INSERT INTO "flex_fee_rules" ("id", "kind", "name", "mode", "numerator", "denominator", "fixed_amount", "is_default", "sort_order", "updated_at") VALUES
  ('6b0f6a7e-1d1a-4c51-9a01-000000000001', 'DEPOSIT',          '1/3 del mes',            'RENT_FRACTION', 1,  3,   NULL, true,  0, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a01-000000000002', 'DEPOSIT',          '1 mes de alquiler',      'RENT_FRACTION', 1,  1,   NULL, false, 1, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a02-000000000001', 'ENTRY_COMMISSION', 'Sin comisión de ingreso', 'NONE',         NULL, NULL, NULL, true,  0, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a02-000000000002', 'ENTRY_COMMISSION', '1/3 del primer mes',     'RENT_FRACTION', 1,  3,   NULL, false, 1, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a02-000000000003', 'ENTRY_COMMISSION', '50% del primer mes',     'RENT_FRACTION', 50, 100, NULL, false, 2, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a02-000000000004', 'ENTRY_COMMISSION', '70% del primer mes',     'RENT_FRACTION', 70, 100, NULL, false, 3, CURRENT_TIMESTAMP),
  ('6b0f6a7e-1d1a-4c51-9a02-000000000005', 'ENTRY_COMMISSION', '100% del primer mes',    'RENT_FRACTION', 1,  1,   NULL, false, 4, CURRENT_TIMESTAMP);

-- Un depósito fijo por cada monto personalizado distinto que ya existía
INSERT INTO "flex_fee_rules" ("id", "kind", "name", "mode", "fixed_amount", "sort_order", "updated_at")
SELECT gen_random_uuid(), 'DEPOSIT', 'Depósito fijo ' || d."custom_deposit_amount"::text, 'FIXED', d."custom_deposit_amount", 10, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "custom_deposit_amount"
  FROM "property_flex_pricing_plans"
  WHERE "deposit_rule" = 'CUSTOM' AND "custom_deposit_amount" IS NOT NULL
) d;

-- AlterTable
ALTER TABLE "property_flex_pricing_plans"
  ADD COLUMN "deposit_rule_id" UUID,
  ADD COLUMN "entry_commission_rule_id" UUID;

-- Migrar datos de los enums a las nuevas FKs
UPDATE "property_flex_pricing_plans" SET "deposit_rule_id" = CASE
    WHEN "deposit_rule" = 'ONE_MONTH_RENT' THEN '6b0f6a7e-1d1a-4c51-9a01-000000000002'::uuid
    ELSE '6b0f6a7e-1d1a-4c51-9a01-000000000001'::uuid
  END;

UPDATE "property_flex_pricing_plans" p SET "deposit_rule_id" = r."id"
FROM "flex_fee_rules" r
WHERE p."deposit_rule" = 'CUSTOM'
  AND p."custom_deposit_amount" IS NOT NULL
  AND r."kind" = 'DEPOSIT' AND r."mode" = 'FIXED'
  AND r."fixed_amount" = p."custom_deposit_amount";

UPDATE "property_flex_pricing_plans" SET "entry_commission_rule_id" = CASE "entry_commission_rule"
    WHEN 'THIRD_FIRST_MONTH'   THEN '6b0f6a7e-1d1a-4c51-9a02-000000000002'::uuid
    WHEN 'HALF_FIRST_MONTH'    THEN '6b0f6a7e-1d1a-4c51-9a02-000000000003'::uuid
    WHEN 'SEVENTY_FIRST_MONTH' THEN '6b0f6a7e-1d1a-4c51-9a02-000000000004'::uuid
    WHEN 'FULL_FIRST_MONTH'    THEN '6b0f6a7e-1d1a-4c51-9a02-000000000005'::uuid
    ELSE '6b0f6a7e-1d1a-4c51-9a02-000000000001'::uuid
  END;

-- Eliminar columnas y enums anteriores
ALTER TABLE "property_flex_pricing_plans"
  DROP COLUMN "deposit_rule",
  DROP COLUMN "custom_deposit_amount",
  DROP COLUMN "entry_commission_rule";

DROP TYPE "FlexDepositRule";
DROP TYPE "FlexEntryCommissionRule";

-- AddForeignKey
ALTER TABLE "property_flex_pricing_plans" ADD CONSTRAINT "property_flex_pricing_plans_deposit_rule_id_fkey" FOREIGN KEY ("deposit_rule_id") REFERENCES "flex_fee_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_flex_pricing_plans" ADD CONSTRAINT "property_flex_pricing_plans_entry_commission_rule_id_fkey" FOREIGN KEY ("entry_commission_rule_id") REFERENCES "flex_fee_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
