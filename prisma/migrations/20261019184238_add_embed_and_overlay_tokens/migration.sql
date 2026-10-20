-- AlterTable
ALTER TABLE "game_session" ADD COLUMN     "clock_running" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clock_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "client_embed_token" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "allowed_origins" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_embed_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_overlay_token" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_overlay_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "client_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_embed_token_token_hash_key" ON "client_embed_token"("token_hash");

-- CreateIndex
CREATE INDEX "client_embed_token_client_id_idx" ON "client_embed_token"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_overlay_token_token_hash_key" ON "client_overlay_token"("token_hash");

-- CreateIndex
CREATE INDEX "client_overlay_token_client_id_idx" ON "client_overlay_token"("client_id");

-- CreateIndex
CREATE INDEX "client_overlay_token_match_id_idx" ON "client_overlay_token"("match_id");

-- CreateIndex
CREATE INDEX "audit_log_client_id_created_at_idx" ON "audit_log"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_created_at_idx" ON "audit_log"("entity_type", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_created_at_idx" ON "audit_log"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "client_embed_token" ADD CONSTRAINT "client_embed_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_overlay_token" ADD CONSTRAINT "client_overlay_token_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_overlay_token" ADD CONSTRAINT "client_overlay_token_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
