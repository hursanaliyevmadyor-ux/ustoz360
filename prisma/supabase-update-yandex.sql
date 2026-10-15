-- Yandex orqali kirish uchun ustun. Xavfsiz: istalgancha marta ishga tushirish mumkin.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "yandexId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_yandexId_key" ON "User"("yandexId");
