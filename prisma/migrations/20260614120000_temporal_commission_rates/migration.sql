ALTER TABLE "properties"
  ADD COLUMN "commission_rate" DECIMAL(5, 2);

CREATE TABLE "ambassador_property_commissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_profile_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "rate" DECIMAL(5, 2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ambassador_property_commissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ambassador_property_commissions_professional_profile_id_fkey"
    FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "ambassador_property_commissions_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ambassador_property_commissions_professional_profile_id_property_id_key"
  ON "ambassador_property_commissions"("professional_profile_id", "property_id");

CREATE INDEX "ambassador_property_commissions_property_id_idx"
  ON "ambassador_property_commissions"("property_id");
