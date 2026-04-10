-- AlterTable: add phone and terms_accepted_at to users
ALTER TABLE "users"
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;

-- AlterTable: add ambassador_requested_at to professional_profiles
ALTER TABLE "professional_profiles"
  ADD COLUMN "ambassador_requested_at" TIMESTAMPTZ;
