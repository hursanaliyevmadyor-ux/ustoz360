-- USTOZ 360: email+parol kirishga o'tish. Supabase SQL Editor'da BIR MARTA ishga tushiring.
-- (Avval o'rnatilgan sxemaga qo'shimcha: telefon ixtiyoriy, email/parol ustunlari qo'shiladi, eski OTP jadvali o'chiriladi.)

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "OtpCode";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

