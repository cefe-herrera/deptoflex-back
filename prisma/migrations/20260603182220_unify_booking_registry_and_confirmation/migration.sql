/*
  Warnings:

  - A unique constraint covering the columns `[flex_booking_id]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reservation_intent_id]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cloudbeds_reservation_id]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('CLOUDBEDS', 'FLEX', 'DIRECT');

-- AlterEnum
ALTER TYPE "ReservationIntentStatus" ADD VALUE 'CONFIRMED';

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_unit_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cloudbeds_reservation_id" VARCHAR(100),
ADD COLUMN     "flex_booking_id" UUID,
ADD COLUMN     "property_flex_id" UUID,
ADD COLUMN     "property_id" UUID,
ADD COLUMN     "reservation_intent_id" UUID,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'DIRECT',
ALTER COLUMN "unit_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reservation_intents" ADD COLUMN     "professional_profile_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_flex_booking_id_key" ON "bookings"("flex_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reservation_intent_id_key" ON "bookings"("reservation_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cloudbeds_reservation_id_key" ON "bookings"("cloudbeds_reservation_id");

-- CreateIndex
CREATE INDEX "bookings_source_idx" ON "bookings"("source");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_flex_id_fkey" FOREIGN KEY ("property_flex_id") REFERENCES "property_flex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_flex_booking_id_fkey" FOREIGN KEY ("flex_booking_id") REFERENCES "flex_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reservation_intent_id_fkey" FOREIGN KEY ("reservation_intent_id") REFERENCES "reservation_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_intents" ADD CONSTRAINT "reservation_intents_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
