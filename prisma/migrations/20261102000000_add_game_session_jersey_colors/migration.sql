-- AlterTable
ALTER TABLE "game_session" ADD COLUMN IF NOT EXISTS "home_jersey_color" TEXT,
ADD COLUMN IF NOT EXISTS "away_jersey_color" TEXT;
