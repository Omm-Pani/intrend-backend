/*
  Warnings:

  - Changed the type of `expiry_date` on the `YtChannel` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "YtChannel" DROP COLUMN "expiry_date",
ADD COLUMN     "expiry_date" TIMESTAMP(3) NOT NULL;
