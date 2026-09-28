-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "logo" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_api_key" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used" TIMESTAMP(3),

    CONSTRAINT "client_api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_api_key_key_hash_key" ON "client_api_key"("key_hash");

-- Insert Default Client for Migration
INSERT INTO "client" ("id", "name", "is_active", "created_at", "updated_at") VALUES ('optiq-internal-client-id', 'Optiq Sports Internal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "client_id" TEXT,
ADD COLUMN     "match_key" TEXT;

-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "client_id" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "client_id" TEXT;

-- Backfill Data
UPDATE "match" SET "client_id" = 'optiq-internal-client-id';
UPDATE "tournament" SET "client_id" = 'optiq-internal-client-id';
UPDATE "user" SET "client_id" = 'optiq-internal-client-id' WHERE "role" != 'SUPER_ADMIN';

-- Make client_id NOT NULL for match and tournament
ALTER TABLE "match" ALTER COLUMN "client_id" SET NOT NULL;
ALTER TABLE "tournament" ALTER COLUMN "client_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "match_match_key_key" ON "match"("match_key");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_api_key" ADD CONSTRAINT "client_api_key_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
