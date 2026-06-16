-- CreateEnum
CREATE TYPE "FlexBookingPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADOPAGO');

-- AlterTable
ALTER TABLE "flex_bookings" ADD COLUMN "payment_token" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "flex_bookings_payment_token_key" ON "flex_bookings"("payment_token");

-- CreateTable
CREATE TABLE "flex_booking_payments" (
    "id" UUID NOT NULL,
    "flex_booking_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADOPAGO',
    "status" "FlexBookingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "mp_preference_id" VARCHAR(100),
    "mp_payment_id" VARCHAR(100),
    "checkout_url" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flex_booking_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flex_booking_payments_mp_preference_id_key" ON "flex_booking_payments"("mp_preference_id");

-- CreateIndex
CREATE UNIQUE INDEX "flex_booking_payments_mp_payment_id_key" ON "flex_booking_payments"("mp_payment_id");

-- CreateIndex
CREATE INDEX "flex_booking_payments_flex_booking_id_status_idx" ON "flex_booking_payments"("flex_booking_id", "status");

-- AddForeignKey
ALTER TABLE "flex_booking_payments" ADD CONSTRAINT "flex_booking_payments_flex_booking_id_fkey" FOREIGN KEY ("flex_booking_id") REFERENCES "flex_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
