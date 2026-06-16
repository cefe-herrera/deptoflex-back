-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CANCELLATION_REQUESTED';

-- DropForeignKey
ALTER TABLE "agency_team_members" DROP CONSTRAINT "agency_team_members_agency_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "agency_team_members" DROP CONSTRAINT "agency_team_members_company_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "ambassador_documents" DROP CONSTRAINT "ambassador_documents_media_file_id_fkey";

-- DropForeignKey
ALTER TABLE "ambassador_documents" DROP CONSTRAINT "ambassador_documents_professional_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "ambassador_property_commissions" DROP CONSTRAINT "ambassador_property_commissions_professional_profile_id_fkey";

-- DropForeignKey
ALTER TABLE "ambassador_property_commissions" DROP CONSTRAINT "ambassador_property_commissions_property_id_fkey";

-- AlterTable
ALTER TABLE "agency_team_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ambassador_documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ambassador_property_commissions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "booking_cancellation_requests" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "adminNotes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "booking_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_cancellation_requests_booking_id_status_idx" ON "booking_cancellation_requests"("booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_cancellation_requests_status_idx" ON "booking_cancellation_requests"("status");

-- AddForeignKey
ALTER TABLE "ambassador_documents" ADD CONSTRAINT "ambassador_documents_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_documents" ADD CONSTRAINT "ambassador_documents_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_team_members" ADD CONSTRAINT "agency_team_members_agency_profile_id_fkey" FOREIGN KEY ("agency_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_team_members" ADD CONSTRAINT "agency_team_members_company_profile_id_fkey" FOREIGN KEY ("company_profile_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_property_commissions" ADD CONSTRAINT "ambassador_property_commissions_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambassador_property_commissions" ADD CONSTRAINT "ambassador_property_commissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cancellation_requests" ADD CONSTRAINT "booking_cancellation_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cancellation_requests" ADD CONSTRAINT "booking_cancellation_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cancellation_requests" ADD CONSTRAINT "booking_cancellation_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ambassador_flex_commissions_professional_profile_id_property_f_" RENAME TO "ambassador_flex_commissions_professional_profile_id_propert_key";

-- RenameIndex
ALTER INDEX "ambassador_property_commissions_professional_profile_id_propert" RENAME TO "ambassador_property_commissions_professional_profile_id_pro_key";
