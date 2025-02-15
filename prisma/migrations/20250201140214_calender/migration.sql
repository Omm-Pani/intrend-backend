-- AlterTable
ALTER TABLE "CalendarEvent" ALTER COLUMN "timeCreated" DROP DEFAULT,
ALTER COLUMN "timeCreated" SET DATA TYPE TEXT;
