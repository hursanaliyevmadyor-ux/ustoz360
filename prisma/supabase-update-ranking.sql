-- Ustozlar reytingi va Profil 2.0 (docs/REYTING.md): faqat qo'shimcha ustunlar va indekslar. Istalgancha marta ishga tushirish mumkin. Mavjud ma'lumotga tegmaydi.
-- Ishlatish (o'z terminalingizda): npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-ranking.sql
-- MUHIM: bu SQL kodni joylashtirishdan OLDIN qo'llanadi (kod Profile va Exam jadvallarining yangi ustunlarini tanlaydi).
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "nicknameNormalized" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "avatarPath" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "leaderboardOptInAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "leaderboardHidden" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_nicknameNormalized_key" ON "Profile"("nicknameNormalized");
CREATE INDEX IF NOT EXISTS "Profile_leaderboardOptIn_idx" ON "Profile"("leaderboardOptIn");
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "directionKey" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "rankingEligible" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "ExamAttempt_examId_userId_idx" ON "ExamAttempt"("examId", "userId");
