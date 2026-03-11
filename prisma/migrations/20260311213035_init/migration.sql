-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "player" ADD COLUMN     "gender" TEXT,
ADD COLUMN     "nationality" TEXT;

-- AlterTable
ALTER TABLE "player_team" ADD COLUMN     "is_captain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "name" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "user_profile" ADD COLUMN     "photos" TEXT[];
