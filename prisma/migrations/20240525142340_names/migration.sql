/*
  Warnings:

  - A unique constraint covering the columns `[page_name]` on the table `Fbpage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `page_name` to the `Fbpage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Fbpage" ADD COLUMN     "page_name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Fbpage_page_name_key" ON "Fbpage"("page_name");
