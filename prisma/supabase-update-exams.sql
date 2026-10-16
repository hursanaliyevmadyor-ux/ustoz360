-- Imtihon simulyatori jadvallari. Xavfsiz: istalgancha marta ishga tushirish mumkin.
CREATE TABLE IF NOT EXISTS "Exam" ("id" TEXT NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "subject" TEXT NOT NULL, "kind" TEXT NOT NULL, "durationMin" INTEGER NOT NULL, "pickCount" INTEGER, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Exam_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "Exam_slug_key" ON "Exam"("slug");
CREATE TABLE IF NOT EXISTS "ExamQuestion" ("id" TEXT NOT NULL, "examId" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, "type" TEXT NOT NULL, "text" TEXT NOT NULL, "options" JSONB, "correct" INTEGER, "accepted" JSONB, "explanation" TEXT, CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "ExamQuestion_examId_idx" ON "ExamQuestion"("examId");
CREATE TABLE IF NOT EXISTS "ExamAttempt" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "examId" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" TIMESTAMP(3) NOT NULL, "submittedAt" TIMESTAMP(3), "order" JSONB NOT NULL, "answers" JSONB NOT NULL DEFAULT '{}', "score" INTEGER, "total" INTEGER, "leftCount" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "ExamAttempt_userId_startedAt_idx" ON "ExamAttempt"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "ExamAttempt_examId_idx" ON "ExamAttempt"("examId");
DO $$ BEGIN ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamAttempt" ENABLE ROW LEVEL SECURITY;
