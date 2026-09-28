/*
  Warnings:

  - You are about to drop the column `client_id` on the `user` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_client_id_fkey";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "client_id";

-- CreateTable
CREATE TABLE "client_user" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_user_user_id_idx" ON "client_user"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_user_client_id_user_id_key" ON "client_user"("client_id", "user_id");

-- AddForeignKey
ALTER TABLE "client_user" ADD CONSTRAINT "client_user_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_user" ADD CONSTRAINT "client_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
