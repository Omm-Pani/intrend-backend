-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FbUser" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_token" TEXT NOT NULL,

    CONSTRAINT "FbUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FbPage" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "page_token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "FbPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "FbUser_user_id_key" ON "FbUser"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "FbUser_user_token_key" ON "FbUser"("user_token");

-- CreateIndex
CREATE UNIQUE INDEX "FbPage_page_id_key" ON "FbPage"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "FbPage_page_token_key" ON "FbPage"("page_token");

-- AddForeignKey
ALTER TABLE "FbPage" ADD CONSTRAINT "FbPage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "FbUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
