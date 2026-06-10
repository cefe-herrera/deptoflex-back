-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- AlterTable
ALTER TABLE "professional_profiles"
  ADD COLUMN "dni" VARCHAR(20),
  ADD COLUMN "contact_email" VARCHAR(255),
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "province" VARCHAR(100),
  ADD COLUMN "person_type" "PersonType";
