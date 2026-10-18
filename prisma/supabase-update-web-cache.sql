-- Internet qidiruvi keshi (Tavily kreditini tejash). Faqat QO'SHIMCHA: mavjud ma'lumot o'zgarmaydi. Istalgancha marta ishga tushirish mumkin.
-- Qo'llash: npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-web-cache.sql
CREATE TABLE IF NOT EXISTS "WebSearchCache" (
    "key" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebSearchCache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "WebSearchCache_createdAt_idx" ON "WebSearchCache"("createdAt");
ALTER TABLE "WebSearchCache" ENABLE ROW LEVEL SECURITY;
