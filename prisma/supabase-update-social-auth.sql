-- USTOZ 360: Google va Telegram orqali kirish uchun ustunlar. Supabase SQL Editor'da BIR MARTA ishga tushiring.
-- Tartib: avval supabase-update-email-auth.sql (agar hali ishga tushirmagan bo'lsangiz), keyin shu fayl.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "googleSub" TEXT,
ADD COLUMN     "telegramId" TEXT,
ADD COLUMN     "telegramUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

