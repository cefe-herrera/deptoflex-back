-- Partner API: el límite de requests por minuto pasa a ser opcional (NULL = sin límite).
-- En esta primera etapa ningún cliente tiene límite.

-- AlterTable
ALTER TABLE "api_clients" ALTER COLUMN "rpm_limit" DROP NOT NULL,
ALTER COLUMN "rpm_limit" DROP DEFAULT;

UPDATE "api_clients" SET "rpm_limit" = NULL;
