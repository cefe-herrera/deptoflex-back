-- CreateEnum
CREATE TYPE "CommissionSettlementStatus" AS ENUM ('DRAFT', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "professional_profiles" ADD COLUMN "bank_cbu_cvu" VARCHAR(30),
ADD COLUMN "bank_alias" VARCHAR(100),
ADD COLUMN "bank_account_holder" VARCHAR(200),
ADD COLUMN "bank_name" VARCHAR(100);

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN "settlement_id" UUID,
ADD COLUMN "approved_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "commission_settlements" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "status" "CommissionSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "payment_method" VARCHAR(100),
    "payment_reference" VARCHAR(255),
    "notes" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "paid_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_settlements_professional_profile_id_idx" ON "commission_settlements"("professional_profile_id");

-- CreateIndex
CREATE INDEX "commission_settlements_status_idx" ON "commission_settlements"("status");

-- CreateIndex
CREATE INDEX "commissions_settlement_id_idx" ON "commissions"("settlement_id");

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "commission_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settlements" ADD CONSTRAINT "commission_settlements_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
