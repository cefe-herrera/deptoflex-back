-- Partner API: clientes externos, API keys (solo hash) y log de uso.

-- CreateEnum
CREATE TYPE "ApiClientStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "contact_email" VARCHAR(255) NOT NULL,
    "status" "ApiClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "rpm_limit" INTEGER NOT NULL DEFAULT 60,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "prefix" VARCHAR(20) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "last_used_ip" VARCHAR(45),
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_events" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "api_key_id" UUID NOT NULL,
    "endpoint" VARCHAR(100) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "status_code" SMALLINT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "property_id" UUID,
    "checkin" DATE,
    "checkout" DATE,
    "cache_hit" BOOLEAN,
    "total_available" INTEGER,
    "error_message" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_clients_status_idx" ON "api_clients"("status");

-- CreateIndex
CREATE INDEX "api_clients_deleted_at_idx" ON "api_clients"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_client_id_idx" ON "api_keys"("client_id");

-- CreateIndex
CREATE INDEX "api_usage_events_client_id_created_at_idx" ON "api_usage_events"("client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_events_api_key_id_created_at_idx" ON "api_usage_events"("api_key_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_events_property_id_created_at_idx" ON "api_usage_events"("property_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "api_usage_events_created_at_idx" ON "api_usage_events"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

