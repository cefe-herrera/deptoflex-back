-- Tracking de embajador en Cloudbeds (sin API oficial).

-- Nuevo estado de comision para reservas atribuidas via script inyectado (no confiable).
ALTER TYPE "CommissionStatus" ADD VALUE IF NOT EXISTS 'PENDING_VALIDATION';

-- Estados de la sesion de reserva del embajador.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AmbassadorSessionStatus') THEN
    CREATE TYPE "AmbassadorSessionStatus" AS ENUM ('STARTED', 'RECEIVED', 'CONFIRMED');
  END IF;
END$$;

-- Sesion liviana creada antes de abrir el motor de Cloudbeds.
CREATE TABLE "ambassador_booking_sessions" (
  "id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "status" "AmbassadorSessionStatus" NOT NULL DEFAULT 'STARTED',
  "cloudbeds_url" TEXT NOT NULL,
  "booking_id" UUID,
  "cloudbeds_reservation_id" VARCHAR(100),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ambassador_booking_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ambassador_booking_sessions_professional_profile_id_fkey"
    FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ambassador_booking_sessions_booking_id_key"
  ON "ambassador_booking_sessions"("booking_id");

CREATE INDEX "ambassador_booking_sessions_professional_profile_id_idx"
  ON "ambassador_booking_sessions"("professional_profile_id");
