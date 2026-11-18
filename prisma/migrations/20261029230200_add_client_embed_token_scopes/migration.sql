-- AlterTable
ALTER TABLE "client_embed_token" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

