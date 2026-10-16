-- Testlar 2.0: vaziyatli savollar, ko'nikma, mavzu maqsadlari, asoslash matni. Ko'p marta ishga tushirsa ham xavfsiz.
ALTER TYPE "TestMode" ADD VALUE IF NOT EXISTS 'SITUATIONAL';
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "skill" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "objectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserAnswer" ADD COLUMN IF NOT EXISTS "rationale" TEXT;
