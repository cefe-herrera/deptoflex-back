ALTER TABLE "professional_profiles"
  ADD COLUMN "documentation_approved_at" TIMESTAMPTZ,
  ADD COLUMN "documentation_approved_by_id" UUID;

ALTER TABLE "professional_profiles"
  ADD CONSTRAINT "professional_profiles_documentation_approved_by_id_fkey"
  FOREIGN KEY ("documentation_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "professional_profiles_documentation_approved_at_idx"
  ON "professional_profiles"("documentation_approved_at");

-- Auto-approve embajadores que ya tenían documentos cargados antes del flujo de revisión.
UPDATE "professional_profiles" p
SET "documentation_approved_at" = COALESCE(p."verified_at", NOW())
WHERE EXISTS (
  SELECT 1 FROM "ambassador_documents" d WHERE d."professional_profile_id" = p."id"
);
