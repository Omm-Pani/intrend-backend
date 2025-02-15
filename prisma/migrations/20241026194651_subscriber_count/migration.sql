/*
  Warnings:

  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `subscriber_count` to the `Ytchannel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ytchannel" ADD COLUMN     "subscriber_count" TEXT NOT NULL;

-- DropTable
DROP TABLE "Campaign";
