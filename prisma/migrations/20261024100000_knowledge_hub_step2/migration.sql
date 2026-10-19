-- AI Bilim markazi, 2-qadam (docs/KNOWLEDGE-HUB.md): admin paneli ichidagi bilim jadvallari. Faqat qo'shimcha; istalgancha marta ishga tushirish mumkin.
-- Ishlatish (o'z terminalingizda): npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-knowledge-base.sql
-- Mavjud jadval va ma'lumotga tegmaydi. Kod bu jadvallar bo'lmasa ham ishdan chiqmaydi (hubMode=off yoki jadval yo'q: eski yo'l).
-- Eslatma: apply-sql.ts buyruqlarni «;» + yangi qator bo'yicha ajratadi, shuning uchun funksiya bitta qatorda yozilgan.
CREATE TABLE IF NOT EXISTS "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "questionCanonical" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "subject" TEXT,
    "topic" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "audience" TEXT NOT NULL DEFAULT 'teacher',
    "language" TEXT NOT NULL DEFAULT 'uz',
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "ownerRef" TEXT,
    "sourceReferences" JSONB NOT NULL DEFAULT '[]',
    "sourceVersion" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "searchText" TEXT NOT NULL DEFAULT '',
    "servedCount" INTEGER NOT NULL DEFAULT 0,
    "lastServedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "embeddingModelVersion" TEXT,
    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeEntry_status_chk" CHECK ("status" IN ('APPROVED', 'NEEDS_RECHECK', 'STALE', 'FLAGGED', 'ARCHIVED')),
    CONSTRAINT "KnowledgeEntry_category_chk" CHECK ("category" IN ('general', 'normative')),
    CONSTRAINT "KnowledgeEntry_origin_chk" CHECK ("origin" IN ('ADMIN', 'CANDIDATE', 'OFFICIAL_IMPORT')),
    CONSTRAINT "KnowledgeEntry_scope_chk" CHECK ("scope" IN ('GLOBAL', 'ORG', 'USER')),
    CONSTRAINT "KnowledgeEntry_scope_owner_chk" CHECK (("scope" = 'GLOBAL' AND "ownerRef" IS NULL) OR ("scope" <> 'GLOBAL' AND "ownerRef" IS NOT NULL)),
    CONSTRAINT "KnowledgeEntry_normative_chk" CHECK ("category" <> 'normative' OR ("expiresAt" IS NOT NULL AND jsonb_array_length("sourceReferences") > 0))
);
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_status_scope_subject_idx" ON "KnowledgeEntry"("status", "scope", "subject");
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_expiresAt_idx" ON "KnowledgeEntry"("expiresAt");
CREATE TABLE IF NOT EXISTS "KnowledgeFeedback" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "voterRef" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeFeedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeFeedback_rating_chk" CHECK ("rating" IN (-1, 1)),
    CONSTRAINT "KnowledgeFeedback_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeFeedback_entryId_voterRef_key" ON "KnowledgeFeedback"("entryId", "voterRef");
CREATE INDEX IF NOT EXISTS "KnowledgeFeedback_entryId_rating_idx" ON "KnowledgeFeedback"("entryId", "rating");
CREATE TABLE IF NOT EXISTS "KnowledgeCandidate" (
    "id" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "proposedAnswer" TEXT NOT NULL,
    "subject" TEXT,
    "topic" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "generatedByProvider" TEXT NOT NULL,
    "model" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "autoChecks" JSONB NOT NULL DEFAULT '{}',
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "duplicateOfId" TEXT,
    "askCount" INTEGER NOT NULL DEFAULT 1,
    "contributorRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    CONSTRAINT "KnowledgeCandidate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeCandidate_status_chk" CHECK ("reviewStatus" IN ('PENDING_REVIEW', 'NEEDS_SOURCE', 'APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeCandidate_questionKey_key" ON "KnowledgeCandidate"("questionKey");
CREATE INDEX IF NOT EXISTS "KnowledgeCandidate_reviewStatus_createdAt_idx" ON "KnowledgeCandidate"("reviewStatus", "createdAt");
CREATE TABLE IF NOT EXISTS "KnowledgeAudit" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT,
    "candidateId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "KnowledgeAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KnowledgeAudit_at_idx" ON "KnowledgeAudit"("at");
CREATE INDEX IF NOT EXISTS "KnowledgeAudit_entryId_idx" ON "KnowledgeAudit"("entryId");
CREATE OR REPLACE FUNCTION "knowledge_audit_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'KnowledgeAudit faqat qo''shiladi: o''zgartirib yoki o''chirib bo''lmaydi'; END $$;
DROP TRIGGER IF EXISTS "knowledge_audit_no_change" ON "KnowledgeAudit";
CREATE TRIGGER "knowledge_audit_no_change" BEFORE UPDATE OR DELETE ON "KnowledgeAudit" FOR EACH ROW EXECUTE FUNCTION "knowledge_audit_immutable"();
CREATE TABLE IF NOT EXISTS "KnowledgeDemand" (
    "day" DATE NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "asked" INTEGER NOT NULL DEFAULT 0,
    "fromKb" INTEGER NOT NULL DEFAULT 0,
    "byAi" INTEGER NOT NULL DEFAULT 0,
    "unanswered" INTEGER NOT NULL DEFAULT 0,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "unhelpful" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "KnowledgeDemand_pkey" PRIMARY KEY ("day", "subject", "topic")
);
ALTER TABLE "KnowledgeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeCandidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeDemand" ENABLE ROW LEVEL SECURITY;
