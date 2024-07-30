/*
  Warnings:

  - You are about to drop the `FbPage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FbUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FbPage" DROP CONSTRAINT "FbPage_ownerId_fkey";

-- DropTable
DROP TABLE "FbPage";

-- DropTable
DROP TABLE "FbUser";

-- CreateTable
CREATE TABLE "Fbuser" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_token" TEXT NOT NULL,

    CONSTRAINT "Fbuser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fbpage" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "page_token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Fbpage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fbuser_user_id_key" ON "Fbuser"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Fbuser_user_token_key" ON "Fbuser"("user_token");

-- CreateIndex
CREATE UNIQUE INDEX "Fbpage_page_id_key" ON "Fbpage"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "Fbpage_page_token_key" ON "Fbpage"("page_token");

-- AddForeignKey
ALTER TABLE "Fbpage" ADD CONSTRAINT "Fbpage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Fbuser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
