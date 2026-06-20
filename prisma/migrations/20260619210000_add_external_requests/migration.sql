-- CreateEnum
CREATE TYPE "ExternalRequestProvider" AS ENUM ('CLOUDBEDS');

-- CreateEnum
CREATE TYPE "ExternalRequestType" AS ENUM ('ROOM', 'PROPERTY_INFO', 'CALCULATE_TOTALS', 'PREPARE', 'CONFIRMATION');

-- CreateTable
CREATE TABLE "external_requests" (
    "id" UUID NOT NULL,
    "provider" "ExternalRequestProvider" NOT NULL DEFAULT 'CLOUDBEDS',
    "type" "ExternalRequestType" NOT NULL,
    "endpoint" VARCHAR(500),
    "method" VARCHAR(10),
    "request_json" JSONB NOT NULL,
    "response_json" JSONB,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "user_id" UUID,
    "property_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_requests_type_created_at_idx" ON "external_requests"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "external_requests_user_id_idx" ON "external_requests"("user_id");

-- CreateIndex
CREATE INDEX "external_requests_property_id_idx" ON "external_requests"("property_id");

-- CreateIndex
CREATE INDEX "external_requests_provider_type_idx" ON "external_requests"("provider", "type");

-- CreateIndex
CREATE INDEX "external_requests_created_at_idx" ON "external_requests"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "external_requests" ADD CONSTRAINT "external_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_requests" ADD CONSTRAINT "external_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
