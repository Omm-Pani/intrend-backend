/*
  Warnings:

  - You are about to drop the column `company_name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `mobile_number` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "company_name",
DROP COLUMN "mobile_number";
