-- CreateTable
CREATE TABLE "Ytuser" (
    "id" TEXT NOT NULL,
    "user_token" TEXT NOT NULL,

    CONSTRAINT "Ytuser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ytchannel" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_title" TEXT NOT NULL,
    "channel_description" TEXT NOT NULL,
    "channel_thumbnail" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Ytchannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ytuser_user_token_key" ON "Ytuser"("user_token");

-- AddForeignKey
ALTER TABLE "Ytchannel" ADD CONSTRAINT "Ytchannel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Ytuser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
