-- CreateEnum
CREATE TYPE "FlexPricingPlanCode" AS ENUM ('MONTH_1', 'MONTH_3', 'MONTH_6', 'YEAR_1', 'YEAR_2');

-- CreateEnum
CREATE TYPE "FlexDepositRule" AS ENUM ('THIRD_OF_MONTH', 'ONE_MONTH_RENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FlexEntryCommissionRule" AS ENUM ('NONE', 'THIRD_FIRST_MONTH', 'HALF_FIRST_MONTH', 'SEVENTY_FIRST_MONTH', 'FULL_FIRST_MONTH');

-- CreateTable
CREATE TABLE "property_flex_pricing_plans" (
    "id" UUID NOT NULL,
    "property_flex_id" UUID NOT NULL,
    "code" "FlexPricingPlanCode" NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "min_months" SMALLINT NOT NULL,
    "max_months" SMALLINT,
    "monthly_rent" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "rent_includes_expenses" BOOLEAN NOT NULL DEFAULT false,
    "rent_includes_utilities" BOOLEAN NOT NULL DEFAULT false,
    "includes_linens" BOOLEAN NOT NULL DEFAULT false,
    "deposit_rule" "FlexDepositRule" NOT NULL DEFAULT 'THIRD_OF_MONTH',
    "custom_deposit_amount" DECIMAL(10,2),
    "entry_commission_rule" "FlexEntryCommissionRule" NOT NULL DEFAULT 'NONE',
    "conditions_text" TEXT,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "property_flex_pricing_plans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "flex_bookings" ADD COLUMN "pricing_plan_id" UUID,
ADD COLUMN "plan_code" "FlexPricingPlanCode",
ADD COLUMN "entry_commission_amount" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "property_flex_pricing_plans_property_flex_id_is_active_idx" ON "property_flex_pricing_plans"("property_flex_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "property_flex_pricing_plans_property_flex_id_code_key" ON "property_flex_pricing_plans"("property_flex_id", "code");

-- CreateIndex
CREATE INDEX "flex_bookings_pricing_plan_id_idx" ON "flex_bookings"("pricing_plan_id");

-- AddForeignKey
ALTER TABLE "property_flex_pricing_plans" ADD CONSTRAINT "property_flex_pricing_plans_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flex_bookings" ADD CONSTRAINT "flex_bookings_pricing_plan_id_fkey" FOREIGN KEY ("pricing_plan_id") REFERENCES "property_flex_pricing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
