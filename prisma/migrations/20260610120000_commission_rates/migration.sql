-- AlterTable
ALTER TABLE "property_flex" ADD COLUMN "commission_rate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "ambassador_flex_commissions" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "property_flex_id" UUID NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ambassador_flex_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ambassador_flex_commissions_property_flex_id_idx" ON "ambassador_flex_commissions"("property_flex_id");

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_flex_commissions_professional_profile_id_property_f_key" ON "ambassador_flex_commissions"("professional_profile_id", "property_flex_id");

-- AddForeignKey
ALTER TABLE "ambassador_flex_commissions" ADD CONSTRAINT "ambassador_flex_commissions_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_flex_commissions" ADD CONSTRAINT "ambassador_flex_commissions_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
