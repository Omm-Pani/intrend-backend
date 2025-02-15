/*
  Warnings:

  - You are about to drop the `Ytchannel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Ytchannel";

-- CreateTable
CREATE TABLE "YtChannel" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_title" TEXT NOT NULL,
    "channel_description" TEXT NOT NULL,
    "channel_thumbnail" TEXT NOT NULL,
    "subscriber_count" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "YtChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YtChannel_channel_id_key" ON "YtChannel"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "YtChannel_channel_title_key" ON "YtChannel"("channel_title");

-- AddForeignKey
ALTER TABLE "YtChannel" ADD CONSTRAINT "YtChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
