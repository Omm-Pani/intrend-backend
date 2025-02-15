/*
  Warnings:

  - You are about to drop the column `tokens` on the `YtChannel` table. All the data in the column will be lost.
  - Added the required column `access_token` to the `YtChannel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiry_date` to the `YtChannel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refresh_token` to the `YtChannel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "YtChannel" DROP COLUMN "tokens",
ADD COLUMN     "access_token" TEXT NOT NULL,
ADD COLUMN     "expiry_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refresh_token" TEXT NOT NULL;
