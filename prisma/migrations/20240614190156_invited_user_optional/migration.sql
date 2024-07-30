-- CreateTable
CREATE TABLE "InvitedUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "adminId" TEXT,

    CONSTRAINT "InvitedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitedUser_email_key" ON "InvitedUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvitedUser_username_key" ON "InvitedUser"("username");

-- AddForeignKey
ALTER TABLE "InvitedUser" ADD CONSTRAINT "InvitedUser_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
