CREATE TYPE "AmbassadorDocumentType" AS ENUM (
  'DNI_FRONT',
  'DNI_BACK',
  'SELFIE',
  'CUIT_CERTIFICATE',
  'FOUNDING_DOCUMENT'
);

CREATE TABLE "ambassador_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_profile_id" UUID NOT NULL,
  "media_file_id" UUID NOT NULL,
  "document_type" "AmbassadorDocumentType" NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ambassador_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ambassador_documents_professional_profile_id_fkey"
    FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "ambassador_documents_media_file_id_fkey"
    FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "ambassador_documents_professional_profile_id_document_type_key"
  ON "ambassador_documents"("professional_profile_id", "document_type");

CREATE TABLE "agency_team_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "agency_profile_id" UUID NOT NULL,
  "company_profile_id" UUID,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "dni" VARCHAR(20) NOT NULL,
  "phone" VARCHAR(30) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "role_in_company" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agency_team_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agency_team_members_agency_profile_id_fkey"
    FOREIGN KEY ("agency_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "agency_team_members_company_profile_id_fkey"
    FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "agency_team_members_agency_profile_id_idx"
  ON "agency_team_members"("agency_profile_id");
