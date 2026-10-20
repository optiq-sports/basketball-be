-- CreateTable
CREATE TABLE "overlay_scene" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "active_scene" TEXT NOT NULL DEFAULT 'blank',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "scorebug_visible" BOOLEAN NOT NULL DEFAULT true,
    "auto_dismiss_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "overlay_scene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "overlay_scene_client_id_idx" ON "overlay_scene"("client_id");

-- CreateIndex
CREATE INDEX "overlay_scene_match_id_idx" ON "overlay_scene"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "overlay_scene_client_id_match_id_key" ON "overlay_scene"("client_id", "match_id");

-- AddForeignKey
ALTER TABLE "overlay_scene" ADD CONSTRAINT "overlay_scene_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overlay_scene" ADD CONSTRAINT "overlay_scene_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overlay_scene" ADD CONSTRAINT "overlay_scene_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
