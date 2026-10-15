-- Email kodlari (ro'yxatdan o'tishni tasdiqlash va parolni tiklash). Xavfsiz: istalgancha marta ishga tushirish mumkin.
CREATE TABLE IF NOT EXISTS "EmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailCode_email_purpose_createdAt_idx" ON "EmailCode"("email", "purpose", "createdAt");
ALTER TABLE "EmailCode" ENABLE ROW LEVEL SECURITY;

-- Hozirgi parolli akkauntlar (siz oldin ochgan) tasdiqlangan hisoblanadi, shunda ular kira oladi.
-- Bundan keyin ochilgan akkauntlar kod orqali tasdiqlanmaguncha kira olmaydi.
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL AND "passwordHash" IS NOT NULL;
