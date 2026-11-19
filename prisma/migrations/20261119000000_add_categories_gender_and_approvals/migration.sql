-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Category" AS ENUM ('MEN', 'WOMEN', 'MIXED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: team
ALTER TABLE "team" ADD COLUMN IF NOT EXISTS "category" "Category";

-- AlterTable: tournament
ALTER TABLE "tournament" ADD COLUMN IF NOT EXISTS "category" "Category";

-- AlterTable: player (convert free-text gender safely to Gender enum)
ALTER TABLE "player"
  ALTER COLUMN "gender" TYPE "Gender"
  USING (
    CASE
      WHEN UPPER(TRIM("gender")) IN ('MALE', 'M') THEN 'MALE'::"Gender"
      WHEN UPPER(TRIM("gender")) IN ('FEMALE', 'F') THEN 'FEMALE'::"Gender"
      ELSE NULL
    END
  );

-- AlterTable: player_team
ALTER TABLE "player_team"
  ADD COLUMN IF NOT EXISTS "mismatch_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mismatch_reason" TEXT;

-- AlterTable: tournament_team
ALTER TABLE "tournament_team"
  ADD COLUMN IF NOT EXISTS "mismatch_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mismatch_reason" TEXT;

-- AlterTable: match
ALTER TABLE "match"
  ADD COLUMN IF NOT EXISTS "mismatch_approved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "mismatch_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mismatch_reason" TEXT;
