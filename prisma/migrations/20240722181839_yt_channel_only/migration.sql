/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Ytchannel` table. All the data in the column will be lost.
  - You are about to drop the `Ytuser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[channel_id]` on the table `Ytchannel` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[channel_title]` on the table `Ytchannel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Ytchannel" DROP CONSTRAINT "Ytchannel_ownerId_fkey";

-- AlterTable
ALTER TABLE "Ytchannel" DROP COLUMN "ownerId";

-- DropTable
DROP TABLE "Ytuser";

-- CreateIndex
CREATE UNIQUE INDEX "Ytchannel_channel_id_key" ON "Ytchannel"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "Ytchannel_channel_title_key" ON "Ytchannel"("channel_title");
