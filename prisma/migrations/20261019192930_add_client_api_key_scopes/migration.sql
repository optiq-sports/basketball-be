-- AlterTable
ALTER TABLE "client_api_key" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];
