-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'BROADCASTER';

-- DropIndex
DROP INDEX "overlay_scene_client_id_match_id_key";

-- AlterTable
ALTER TABLE "client_overlay_token" ADD COLUMN     "broadcaster_id" TEXT;

-- AlterTable
ALTER TABLE "overlay_scene" ADD COLUMN     "broadcaster_id" TEXT;

-- CreateTable
CREATE TABLE "match_broadcaster" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" TEXT,

    CONSTRAINT "match_broadcaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_broadcaster_match_id_idx" ON "match_broadcaster"("match_id");

-- CreateIndex
CREATE INDEX "match_broadcaster_user_id_idx" ON "match_broadcaster"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_broadcaster_match_id_user_id_key" ON "match_broadcaster"("match_id", "user_id");

-- CreateIndex
CREATE INDEX "client_overlay_token_broadcaster_id_idx" ON "client_overlay_token"("broadcaster_id");

-- CreateIndex
CREATE INDEX "overlay_scene_broadcaster_id_idx" ON "overlay_scene"("broadcaster_id");

-- AddForeignKey
ALTER TABLE "client_overlay_token" ADD CONSTRAINT "client_overlay_token_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overlay_scene" ADD CONSTRAINT "overlay_scene_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_broadcaster" ADD CONSTRAINT "match_broadcaster_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_broadcaster" ADD CONSTRAINT "match_broadcaster_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_broadcaster" ADD CONSTRAINT "match_broadcaster_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
