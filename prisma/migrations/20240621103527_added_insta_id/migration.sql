/*
  Warnings:

  - A unique constraint covering the columns `[insta_business_id]` on the table `Fbpage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Fbpage" ADD COLUMN     "insta_business_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Fbpage_insta_business_id_key" ON "Fbpage"("insta_business_id");
