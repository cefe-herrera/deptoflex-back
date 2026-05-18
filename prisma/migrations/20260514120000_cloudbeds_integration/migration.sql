-- ─────────────────────────────────────────────────────────────────────────────
-- Cloudbeds public booking-engine integration (read-only)
-- ─────────────────────────────────────────────────────────────────────────────

-- Properties: add Cloudbeds mapping + i18n defaults
ALTER TABLE "properties"
  ADD COLUMN "cloudbeds_widget_property_id" VARCHAR(50),
  ADD COLUMN "cloudbeds_booking_slug"       VARCHAR(100),
  ADD COLUMN "default_currency"             VARCHAR(3)  NOT NULL DEFAULT 'ARS',
  ADD COLUMN "default_language"             VARCHAR(5)  NOT NULL DEFAULT 'es';

CREATE UNIQUE INDEX "properties_cloudbeds_widget_property_id_key"
  ON "properties"("cloudbeds_widget_property_id");

-- Units: map to Cloudbeds room_type / unit_id
ALTER TABLE "units"
  ADD COLUMN "cloudbeds_room_type_id" VARCHAR(50),
  ADD COLUMN "cloudbeds_unit_id"      VARCHAR(50);

CREATE UNIQUE INDEX "units_cloudbeds_unit_id_key"
  ON "units"("cloudbeds_unit_id");
CREATE INDEX "units_cloudbeds_room_type_id_idx"
  ON "units"("cloudbeds_room_type_id");

-- ReservationIntent status enum
CREATE TYPE "ReservationIntentStatus" AS ENUM ('PENDING', 'REDIRECTED', 'EXPIRED');

-- AvailabilitySnapshot: audit trail + analytics
CREATE TABLE "availability_snapshots" (
  "id"                         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "property_id"                UUID         NOT NULL,
  "checkin"                    DATE         NOT NULL,
  "checkout"                   DATE         NOT NULL,
  "currency_code"              VARCHAR(3)   NOT NULL,
  "lang"                       VARCHAR(5)   NOT NULL,
  "raw_response_json"          JSONB        NOT NULL,
  "normalized_response_json"   JSONB        NOT NULL,
  "total_available"            INTEGER      NOT NULL DEFAULT 0,
  "http_status"                INTEGER,
  "duration_ms"                INTEGER,
  "created_at"                 TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_snapshots_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "availability_snapshots_property_id_checkin_checkout_idx"
  ON "availability_snapshots"("property_id", "checkin", "checkout");
CREATE INDEX "availability_snapshots_created_at_idx"
  ON "availability_snapshots"("created_at");

-- ReservationIntent: tracks search → click-to-redirect funnel
CREATE TABLE "reservation_intents" (
  "id"            UUID                     NOT NULL DEFAULT gen_random_uuid(),
  "property_id"   UUID                     NOT NULL,
  "room_type_id"  VARCHAR(50)              NOT NULL,
  "rate_id"       VARCHAR(50),
  "checkin"       DATE                     NOT NULL,
  "checkout"      DATE                     NOT NULL,
  "adults"        SMALLINT                 NOT NULL DEFAULT 1,
  "children"      SMALLINT                 NOT NULL DEFAULT 0,
  "total_amount"  DECIMAL(12, 2),
  "currency_code" VARCHAR(3)               NOT NULL,
  "redirect_url"  TEXT                     NOT NULL,
  "status"        "ReservationIntentStatus" NOT NULL DEFAULT 'PENDING',
  "user_id"       UUID,
  "ip_address"    VARCHAR(45),
  "user_agent"    VARCHAR(500),
  "expires_at"    TIMESTAMPTZ              NOT NULL,
  "redirected_at" TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ              NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_intents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_intents_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "reservation_intents_property_id_idx"
  ON "reservation_intents"("property_id");
CREATE INDEX "reservation_intents_status_expires_at_idx"
  ON "reservation_intents"("status", "expires_at");
CREATE INDEX "reservation_intents_created_at_idx"
  ON "reservation_intents"("created_at");
