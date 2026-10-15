-- Telegram bot: telefon raqami orqali ro'yxatdan o'tish. Xavfsiz: istalgancha marta ishga tushirish mumkin.
ALTER TABLE "TelegramLogin" ADD COLUMN IF NOT EXISTS "telegramId" TEXT;
