-- AlterTable
ALTER TABLE "client" ADD COLUMN "client_type" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "client_slug_key" ON "client"("slug");
