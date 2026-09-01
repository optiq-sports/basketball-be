/*
  Warnings:

  - A unique constraint covering the columns `[team_id,jersey_number]` on the table `player_team` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "game_event" ADD COLUMN     "clock_seconds_remaining" INTEGER,
ADD COLUMN     "parent_event_id" TEXT,
ADD COLUMN     "period" INTEGER;

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "statistician_id" TEXT;

-- AlterTable
ALTER TABLE "tournament_team" ADD COLUMN     "group" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_team_team_id_jersey_number_key" ON "player_team"("team_id", "jersey_number");

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_statistician_id_fkey" FOREIGN KEY ("statistician_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_event" ADD CONSTRAINT "game_event_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "game_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
