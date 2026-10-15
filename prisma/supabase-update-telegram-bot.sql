-- Telegram bot orqali kirish va botdagi yangilanishlarni takrorlamaslik uchun jadvallar. Xavfsiz: istalgancha marta ishga tushirish mumkin.
CREATE TABLE IF NOT EXISTS "TelegramLogin" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pollHash" TEXT NOT NULL,
    "userId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramLogin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramLogin_code_key" ON "TelegramLogin"("code");
CREATE INDEX IF NOT EXISTS "TelegramLogin_createdAt_idx" ON "TelegramLogin"("createdAt");
CREATE TABLE IF NOT EXISTS "TelegramUpdate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TelegramLogin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramUpdate" ENABLE ROW LEVEL SECURITY;
