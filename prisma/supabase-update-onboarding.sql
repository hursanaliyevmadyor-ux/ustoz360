-- Birinchi kirishdan keyingi ro'yxatdan o'tish (ism-familiya, yashash joyi) uchun ustunlar. Xavfsiz: istalgancha marta ishga tushirish mumkin.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
