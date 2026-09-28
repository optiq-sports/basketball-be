-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "force_password_change" BOOLEAN NOT NULL DEFAULT false;
