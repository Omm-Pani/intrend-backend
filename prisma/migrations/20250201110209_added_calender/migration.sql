-- CreateTable
CREATE TABLE "CalenderEvent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CalenderEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CalenderEvent" ADD CONSTRAINT "CalenderEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
