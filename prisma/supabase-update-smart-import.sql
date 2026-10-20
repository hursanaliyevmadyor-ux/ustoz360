-- Aqlli fayl import (docs/SMART-IMPORT.md): jadvallar. Faqat qo'shimcha; istalgancha marta ishga tushirish mumkin. Mavjud ma'lumotga tegmaydi.
-- Ishlatish (o'z terminalingizda): npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-smart-import.sql
-- MUHIM: bu SQL kodni joylashtirishdan OLDIN qo'llanadi (kod Question jadvalining yangi ustunlarini tanlaydi).
-- Eslatma: apply-sql.ts buyruqlarni «;» + yangi qator bo'yicha ajratadi, shuning uchun DO bloki bitta qatorda yozilgan.
CREATE TABLE IF NOT EXISTS "ImportSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "step" TEXT NOT NULL DEFAULT 'PARSE',
    "progress" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "error" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ImportSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ImportSession_ownerId_createdAt_idx" ON "ImportSession"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ImportSession_status_updatedAt_idx" ON "ImportSession"("status", "updatedAt");
CREATE TABLE IF NOT EXISTS "ImportFile" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AUTO',
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "parseStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
    "parseError" TEXT,
    "textChars" INTEGER,
    "pageCount" INTEGER,
    "docKinds" JSONB,
    "pages" JSONB,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportFile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ImportFile_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ImportFile_importSessionId_checksum_key" ON "ImportFile"("importSessionId", "checksum");
CREATE INDEX IF NOT EXISTS "ImportFile_importSessionId_idx" ON "ImportFile"("importSessionId");
CREATE TABLE IF NOT EXISTS "ExtractedQuestion" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "fileId" TEXT,
    "number" INTEGER,
    "seq" INTEGER NOT NULL,
    "section" INTEGER NOT NULL DEFAULT 0,
    "originalText" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "qtype" TEXT NOT NULL DEFAULT 'SINGLE',
    "editedText" TEXT,
    "editedOptions" JSONB,
    "subjectGuess" TEXT,
    "topicGuess" TEXT,
    "topicId" TEXT,
    "grade" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "sourcePage" TEXT,
    "ocrUncertain" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "userDecision" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExtractedQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExtractedQuestion_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ExtractedQuestion_importSessionId_seq_idx" ON "ExtractedQuestion"("importSessionId", "seq");
CREATE TABLE IF NOT EXISTS "AnswerVerification" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "keyAnswer" JSONB,
    "keySource" TEXT,
    "proposedAnswer" JSONB,
    "finalAnswer" JSONB,
    "answerOrigin" TEXT NOT NULL DEFAULT 'NONE',
    "explanation" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "confidence" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnswerVerification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnswerVerification_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExtractedQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnswerVerification_questionId_key" ON "AnswerVerification"("questionId");
CREATE TABLE IF NOT EXISTS "PersonalQuestionCollection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "importSessionId" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "sourceNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PRIVATE_ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PersonalQuestionCollection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PersonalQuestionCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonalQuestionCollection_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PersonalQuestionCollection_ownerId_updatedAt_idx" ON "PersonalQuestionCollection"("ownerId", "updatedAt");
CREATE TABLE IF NOT EXISTS "QuestionReviewSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rightsNote" TEXT,
    "note" TEXT,
    "decisions" JSONB,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    CONSTRAINT "QuestionReviewSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuestionReviewSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionReviewSubmission_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PersonalQuestionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuestionReviewSubmission_status_submittedAt_idx" ON "QuestionReviewSubmission"("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "QuestionReviewSubmission_collectionId_idx" ON "QuestionReviewSubmission"("collectionId");
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "collectionId" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "collectionPos" INTEGER;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "importSourceId" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "answerStatus" TEXT;
CREATE INDEX IF NOT EXISTS "Question_collectionId_idx" ON "Question"("collectionId");
CREATE INDEX IF NOT EXISTS "Question_ownerId_idx" ON "Question"("ownerId");
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Question_collectionId_fkey') THEN ALTER TABLE "Question" ADD CONSTRAINT "Question_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PersonalQuestionCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
ALTER TABLE "ImportSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnswerVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PersonalQuestionCollection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionReviewSubmission" ENABLE ROW LEVEL SECURITY;
