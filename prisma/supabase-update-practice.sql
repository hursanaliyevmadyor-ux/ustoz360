-- Bilim laboratoriyasi (Oddiy mashq): qo'shimcha ustunlar va jadval. Ko'p marta ishga tushirsa ham xavfsiz.
ALTER TABLE "TestSession" ADD COLUMN IF NOT EXISTS "config" JSONB;
ALTER TABLE "UserAnswer" ADD COLUMN IF NOT EXISTS "hintUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserAnswer" ADD COLUMN IF NOT EXISTS "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "superKey" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
UPDATE "Question" SET "source" = 'SAMPLE' WHERE "isDemo" = true AND "source" = 'MANUAL';
CREATE TABLE IF NOT EXISTS "QuestionReport" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "QuestionReport_questionId_idx" ON "QuestionReport"("questionId");
