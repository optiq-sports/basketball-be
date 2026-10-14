-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('GROUP', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('ROUND_ROBIN', 'KNOCKOUT', 'GROUP_THEN_KNOCKOUT');

-- AlterTable
ALTER TABLE "match" ADD COLUMN     "stage" "MatchStage";

-- AlterTable
ALTER TABLE "match_stat" ADD COLUMN     "dreb" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eff" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fg3a" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fg3m" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fga" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fgm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ftm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "oreb" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plus_minus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seconds_played" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "three_pa" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "three_pm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "two_pa" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "two_pm" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "team" ADD COLUMN     "arena" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "founded_year" INTEGER;

-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "format" "TournamentFormat";

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_user_id_is_read_idx" ON "notification"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notification_user_id_created_at_idx" ON "notification"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_password_reset_token_key" ON "user"("password_reset_token");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
