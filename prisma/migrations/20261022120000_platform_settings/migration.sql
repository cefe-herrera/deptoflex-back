CREATE TABLE "platform_settings" (
  "key" VARCHAR(100) NOT NULL,
  "value" JSONB NOT NULL,
  "updated_by_id" UUID,
  "updated_at" TIMESTAMPTZ NOT NULL,

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "platform_settings"
  ADD CONSTRAINT "platform_settings_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
