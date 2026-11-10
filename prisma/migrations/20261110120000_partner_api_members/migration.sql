-- Partner API: organizaciones con usuarios (miembros) e invitaciones por email.

-- CreateEnum
CREATE TYPE "ApiClientMemberRole" AS ENUM ('OWNER', 'ADMIN', 'VIEWER');

-- CreateTable
CREATE TABLE "api_client_members" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ApiClientMemberRole" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_client_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_client_invitations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "ApiClientMemberRole" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_client_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_client_members_user_id_key" ON "api_client_members"("user_id");

-- CreateIndex
CREATE INDEX "api_client_members_client_id_idx" ON "api_client_members"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_client_invitations_token_hash_key" ON "api_client_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "api_client_invitations_client_id_idx" ON "api_client_invitations"("client_id");

-- CreateIndex
CREATE INDEX "api_client_invitations_email_idx" ON "api_client_invitations"("email");

-- AddForeignKey
ALTER TABLE "api_client_members" ADD CONSTRAINT "api_client_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_client_members" ADD CONSTRAINT "api_client_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_client_invitations" ADD CONSTRAINT "api_client_invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rol de plataforma para usuarios que solo acceden al portal de la API.
-- Los roles del seed se insertan con id explícito, así que no se usa la secuencia.
INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
SELECT COALESCE(MAX("id"), 0) + 1, 'API_CLIENT', 'Usuario de una organización cliente de la API de disponibilidad', NOW(), NOW()
FROM "roles"
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "name" = 'API_CLIENT');

SELECT setval(pg_get_serial_sequence('"roles"', 'id'), (SELECT MAX("id") FROM "roles"));
