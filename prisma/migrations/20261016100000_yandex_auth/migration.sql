-- AlterTable
ALTER TABLE "User" ADD COLUMN "yandexId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_yandexId_key" ON "User"("yandexId");
