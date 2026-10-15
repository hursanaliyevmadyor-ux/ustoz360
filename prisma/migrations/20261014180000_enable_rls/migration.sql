-- Row Level Security: barcha jadvallarda yoqiladi, siyosat (policy) YO'Q.
-- Natija: Supabase'ning ochiq API'si (anon/authenticated rollari, PostgREST) bu jadvallarga umuman kira olmaydi.
-- Ilova bazaga faqat server orqali, jadval egasi/postgres roli bilan ulanadi (RLS'ni chetlab o'tadi),
-- shuning uchun ilova ishlashi o'zgarmaydi. Brauzerdan to'g'ridan-to'g'ri kirish ataylab yopilgan.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpCode" ENABLE ROW LEVEL SECURITY;
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
