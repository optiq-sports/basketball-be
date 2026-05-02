-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "game_session" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'PENDING',
    "quarter" INTEGER NOT NULL DEFAULT 1,
    "clock_seconds_remaining" INTEGER NOT NULL DEFAULT 600,
    "home_score" INTEGER NOT NULL DEFAULT 0,
    "away_score" INTEGER NOT NULL DEFAULT 0,
    "possession_team_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "jump_ball_winner_team_id" TEXT,
    "home_on_left" BOOLEAN NOT NULL DEFAULT true,
    "home_attacks_left" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_event" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "resulting_version" INTEGER NOT NULL,
    "idempotency_key_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "request_hash" TEXT,
    "command_type" TEXT NOT NULL,
    "response_snapshot" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineup_state" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "home_lineup" JSONB NOT NULL,
    "away_lineup" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lineup_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projection_state" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "projection_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projection_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_session_match_id_key" ON "game_session"("match_id");

-- CreateIndex
CREATE INDEX "game_session_status_updated_at_idx" ON "game_session"("status", "updated_at");

-- CreateIndex
CREATE INDEX "game_event_session_id_created_at_idx" ON "game_event"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "game_event_session_id_sequence_key" ON "game_event"("session_id", "sequence");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_session_id_key_key" ON "idempotency_record"("session_id", "key");

-- CreateIndex
CREATE INDEX "lineup_state_session_id_captured_at_idx" ON "lineup_state"("session_id", "captured_at");

-- CreateIndex
CREATE INDEX "projection_state_session_id_updated_at_idx" ON "projection_state"("session_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "projection_state_session_id_projection_type_key" ON "projection_state"("session_id", "projection_type");

-- AddForeignKey
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_idempotency_key_id_fkey" FOREIGN KEY ("idempotency_key_id") REFERENCES "idempotency_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_record" ADD CONSTRAINT "idempotency_record_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineup_state" ADD CONSTRAINT "lineup_state_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projection_state" ADD CONSTRAINT "projection_state_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
