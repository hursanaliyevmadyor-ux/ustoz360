-- Knowledge Hub, 1-qadam (docs/KNOWLEDGE-HUB.md). Faqat qo'shimcha; istalgancha marta ishga tushirish mumkin.
-- Ishlatish (o'z terminalingizda): npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-knowledge-hub.sql
-- MUHIM: bu SQL kodni deploy qilishdan OLDIN qo'llanadi.
ALTER TABLE "AiRequest" ADD COLUMN IF NOT EXISTS "provider" TEXT;
CREATE TABLE IF NOT EXISTS "KnowledgeConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "KnowledgeConsent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeConsent_userId_purpose_key" ON "KnowledgeConsent"("userId", "purpose");
ALTER TABLE "KnowledgeConsent" ENABLE ROW LEVEL SECURITY;
