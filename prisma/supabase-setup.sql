-- USTOZ 360: Supabase SQL Editor uchun to'liq o'rnatish (sxema + RLS + DEMO savollar). Bo'sh bazada bir marta ishga tushiring.
-- Eski versiyani o'rnatgan bo'lsangiz, bu faylni emas, supabase-update-email-auth.sql va supabase-update-social-auth.sql ni (shu tartibda) ishlating.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('TEACHER', 'COURSE_AUTHOR', 'ORG_MANAGER', 'METHODIST', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TestMode" AS ENUM ('DIAGNOSTIC', 'PRACTICE', 'TIMED', 'TOPIC', 'MIXED', 'ERRORS', 'SIMULATION');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "googleSub" TEXT,
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "subjectFocus" TEXT,
    "grades" TEXT,
    "experience" INTEGER,
    "category" TEXT,
    "targetExam" TEXT,
    "examDate" TIMESTAMP(3),
    "dailyMinutes" INTEGER,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleKey" NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "TestMode" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionIds" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "total" INTEGER,

    CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "UserAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "confidence" "Confidence" NOT NULL DEFAULT 'LOW',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "mistakes" INTEGER NOT NULL DEFAULT 1,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "lastMistakeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_organizationId_key" ON "UserRole"("userId", "role", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");

-- CreateIndex
CREATE INDEX "Question_status_topicId_idx" ON "Question"("status", "topicId");

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_idx" ON "AnswerOption"("questionId");

-- CreateIndex
CREATE INDEX "TestSession_userId_startedAt_idx" ON "TestSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnswer_sessionId_questionId_key" ON "UserAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicMastery_userId_topicId_key" ON "TopicMastery"("userId", "topicId");

-- CreateIndex
CREATE INDEX "ErrorCard_userId_nextReviewAt_idx" ON "ErrorCard"("userId", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorCard_userId_questionId_key" ON "ErrorCard"("userId", "questionId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnswer" ADD CONSTRAINT "UserAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicMastery" ADD CONSTRAINT "TopicMastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorCard" ADD CONSTRAINT "ErrorCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorCard" ADD CONSTRAINT "ErrorCard_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------- RLS ----------
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnswerOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TopicMastery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ErrorCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;


-- ---------- DEMO savollar (isDemo=true, ekspert tekshirmagan; faqat tizimni sinash uchun) ----------
INSERT INTO "Subject" (id, slug, name) VALUES ('demo_subject','umumiy-pedagogika','Umumiy pedagogika (DEMO)') ON CONFLICT DO NOTHING;
INSERT INTO "Topic" (id, "subjectId", slug, name) VALUES ('demo_t_formativ-baholash','demo_subject','formativ-baholash',$q$Formativ baholash$q$) ON CONFLICT DO NOTHING;
INSERT INTO "Topic" (id, "subjectId", slug, name) VALUES ('demo_t_pedagogik-mahorat','demo_subject','pedagogik-mahorat',$q$Pedagogik mahorat$q$) ON CONFLICT DO NOTHING;
INSERT INTO "Topic" (id, "subjectId", slug, name) VALUES ('demo_t_matematika-metodikasi','demo_subject','matematika-metodikasi',$q$Matematika metodikasi$q$) ON CONFLICT DO NOTHING;
INSERT INTO "Topic" (id, "subjectId", slug, name) VALUES ('demo_t_kasb-standarti','demo_subject','kasb-standarti',$q$Kasb standarti$q$) ON CONFLICT DO NOTHING;
INSERT INTO "Topic" (id, "subjectId", slug, name) VALUES ('demo_t_inklyuziv-talim','demo_subject','inklyuziv-talim',$q$Inklyuziv ta'lim$q$) ON CONFLICT DO NOTHING;
INSERT INTO "Question" (id,"topicId",text,explanation,difficulty,status,"isDemo") VALUES ('demo_q1','demo_t_formativ-baholash',$q$Formativ baholashning asosiy maqsadi nima?$q$,$q$Formativ baholash jarayon davomida o'qituvchi va o'quvchiga keyingi qadam uchun ma'lumot beradi.$q$,'EASY','APPROVED',true) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q1_o0','demo_q1',$q$O'quv yili oxirida yakuniy ball qo'yish$q$,false,0) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q1_o1','demo_q1',$q$O'qitish jarayonida qayta aloqa berib, o'rganishni yo'naltirish$q$,true,1) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q1_o2','demo_q1',$q$O'quvchilarni reytingga qo'yish$q$,false,2) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q1_o3','demo_q1',$q$Faqat uy vazifasini tekshirish$q$,false,3) ON CONFLICT DO NOTHING;
INSERT INTO "Question" (id,"topicId",text,explanation,difficulty,status,"isDemo") VALUES ('demo_q2','demo_t_pedagogik-mahorat',$q$Dars maqsadi qaysi holatda to'g'ri qo'yilgan?$q$,$q$Maqsad o'quvchi nimaga erishishini o'lchanadigan fe'l bilan ifodalashi kerak.$q$,'MEDIUM','APPROVED',true) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q2_o0','demo_q2',$q$Mavzuni tushuntirish$q$,false,0) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q2_o1','demo_q2',$q$O'quvchi kasrlarni solishtira oladi$q$,true,1) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q2_o2','demo_q2',$q$Darslikning 12-betini o'qish$q$,false,2) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q2_o3','demo_q2',$q$Dars vaqtida tartib saqlash$q$,false,3) ON CONFLICT DO NOTHING;
INSERT INTO "Question" (id,"topicId",text,explanation,difficulty,status,"isDemo") VALUES ('demo_q3','demo_t_matematika-metodikasi',$q$Bo'lish amalini tushunishda ko'paytirish bilan bog'liqlik nimani bildiradi?$q$,$q$Bo'lish ko'paytirishga teskari amal: 12 : 3 = 4, chunki 3 × 4 = 12.$q$,'MEDIUM','APPROVED',true) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q3_o0','demo_q3',$q$Ular bir-biriga bog'liq emas$q$,false,0) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q3_o1','demo_q3',$q$Bo'lish — ko'paytirishga teskari amal$q$,true,1) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q3_o2','demo_q3',$q$Bo'lish faqat qoldiqli bo'ladi$q$,false,2) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q3_o3','demo_q3',$q$Ko'paytirish bo'lishdan keyin o'rganiladi$q$,false,3) ON CONFLICT DO NOTHING;
INSERT INTO "Question" (id,"topicId",text,explanation,difficulty,status,"isDemo") VALUES ('demo_q4','demo_t_kasb-standarti',$q$Qaysi holat o'qituvchining kasbiy rivojlanish talabiga to'g'ri keladi?$q$,$q$Kasbiy rivojlanish refleksiya va rejali o'sishga asoslanadi.$q$,'HARD','APPROVED',true) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q4_o0','demo_q4',$q$Bir marta kursga borib, qayta o'qimaslik$q$,false,0) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q4_o1','demo_q4',$q$O'z faoliyatini tahlil qilib, rejali malaka oshirish$q$,true,1) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q4_o2','demo_q4',$q$Faqat sertifikat to'plash$q$,false,2) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q4_o3','demo_q4',$q$Boshqalarning dars rejasini ko'chirish$q$,false,3) ON CONFLICT DO NOTHING;
INSERT INTO "Question" (id,"topicId",text,explanation,difficulty,status,"isDemo") VALUES ('demo_q5','demo_t_inklyuziv-talim',$q$Differensial topshiriqlar nima uchun beriladi?$q$,$q$Maqsad bir, yo'llar va murakkablik darajasi turlicha.$q$,'EASY','APPROVED',true) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q5_o0','demo_q5',$q$Bir xil topshiriq berish uchun$q$,false,0) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q5_o1','demo_q5',$q$Turli tayyorgarlikdagi o'quvchilar bir maqsadga erishishi uchun$q$,true,1) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q5_o2','demo_q5',$q$O'quvchilarni guruhlarga bo'lib ajratish uchun$q$,false,2) ON CONFLICT DO NOTHING;
INSERT INTO "AnswerOption" (id,"questionId",text,"isCorrect",position) VALUES ('demo_q5_o3','demo_q5',$q$Vaqtni qisqartirish uchun$q$,false,3) ON CONFLICT DO NOTHING;

-- AI bo'limi uchun jadval. Xavfsiz: istalgancha marta ishga tushirish mumkin.
CREATE TABLE IF NOT EXISTS "AiRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiRequest_userId_createdAt_idx" ON "AiRequest"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRequest_createdAt_idx" ON "AiRequest"("createdAt");
DO $$ BEGIN
  ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "AiRequest" ENABLE ROW LEVEL SECURITY;

-- Yandex orqali kirish uchun ustun. Xavfsiz: istalgancha marta ishga tushirish mumkin.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "yandexId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_yandexId_key" ON "User"("yandexId");
