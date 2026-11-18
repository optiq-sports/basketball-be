-- DropIndex
DROP INDEX IF EXISTS "player_team_team_id_jersey_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "player_team_team_id_jersey_number_active_key" ON "player_team"("team_id", "jersey_number") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "player_team_team_id_jersey_number_idx" ON "player_team"("team_id", "jersey_number");

