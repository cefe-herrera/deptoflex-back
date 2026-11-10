-- Partner API: solicitudes de reserva/cancelación que un admin gestiona a mano en Cloudbeds.

-- CreateEnum
CREATE TYPE "PartnerBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLATION_REQUESTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "partner_booking_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "api_key_id" UUID NOT NULL,
    "external_reference" VARCHAR(100),
    "status" "PartnerBookingStatus" NOT NULL DEFAULT 'PENDING',
    "property_id" UUID NOT NULL,
    "room_type_id" VARCHAR(50) NOT NULL,
    "room_name" VARCHAR(200),
    "rate_id" VARCHAR(50),
    "checkin" DATE NOT NULL,
    "checkout" DATE NOT NULL,
    "nights" SMALLINT NOT NULL,
    "adults" SMALLINT NOT NULL,
    "children" SMALLINT NOT NULL DEFAULT 0,
    "guest_first_name" VARCHAR(100) NOT NULL,
    "guest_last_name" VARCHAR(100) NOT NULL,
    "guest_email" VARCHAR(255) NOT NULL,
    "guest_phone" VARCHAR(40) NOT NULL,
    "guest_document" VARCHAR(40),
    "guest_nationality" VARCHAR(60),
    "notes" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "final_price" DECIMAL(12,2) NOT NULL,
    "partner_commission" DECIMAL(12,2) NOT NULL,
    "net_price" DECIMAL(12,2) NOT NULL,
    "quoted_price" DECIMAL(12,2),
    "price_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "cloudbeds_reservation_id" VARCHAR(100),
    "admin_notes" TEXT,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "rejected_at" TIMESTAMPTZ,
    "cancellation_requested_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "handled_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "partner_booking_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_booking_requests_status_created_at_idx" ON "partner_booking_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "partner_booking_requests_client_id_created_at_idx" ON "partner_booking_requests"("client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "partner_booking_requests_property_id_idx" ON "partner_booking_requests"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_booking_requests_client_id_external_reference_key" ON "partner_booking_requests"("client_id", "external_reference");

-- AddForeignKey
ALTER TABLE "partner_booking_requests" ADD CONSTRAINT "partner_booking_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_booking_requests" ADD CONSTRAINT "partner_booking_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

