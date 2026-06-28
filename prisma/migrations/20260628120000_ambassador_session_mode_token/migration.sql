-- Ambassador booking sessions: mode, tracking token, booking context
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AmbassadorSessionMode') THEN
    CREATE TYPE "AmbassadorSessionMode" AS ENUM ('AMBASSADOR', 'GUEST');
  END IF;
END $$;

ALTER TABLE "ambassador_booking_sessions"
  ADD COLUMN IF NOT EXISTS "mode" "AmbassadorSessionMode" NOT NULL DEFAULT 'AMBASSADOR',
  ADD COLUMN IF NOT EXISTS "tracking_token_hash" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "property_id" UUID,
  ADD COLUMN IF NOT EXISTS "booking_context" JSONB,
  ADD COLUMN IF NOT EXISTS "guest_return_url" TEXT,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "ambassador_booking_sessions_tracking_token_hash_idx"
  ON "ambassador_booking_sessions" ("tracking_token_hash");
