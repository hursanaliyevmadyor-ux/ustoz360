-- Telegram bot: suhbat holati va kunlik eslatma sozlamasi. Faqat QO'SHIMCHA: mavjud ma'lumot o'zgarmaydi. Istalgancha marta ishga tushirish mumkin.
-- Qo'llash: npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-bot-state.sql
CREATE TABLE IF NOT EXISTS "BotState" (
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'idle',
    "data" JSONB,
    "remind" BOOLEAN NOT NULL DEFAULT true,
    "remindedOn" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotState_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "BotState" DROP CONSTRAINT IF EXISTS "BotState_userId_fkey";
ALTER TABLE "BotState" ADD CONSTRAINT "BotState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BotState" ENABLE ROW LEVEL SECURITY;
