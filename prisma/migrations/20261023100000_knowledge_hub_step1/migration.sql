-- Knowledge Hub, 1-qadam (docs/KNOWLEDGE-HUB.md). Faqat qo'shimcha: mavjud ma'lumot va jadvallar o'zgarmaydi.

-- AlterTable
ALTER TABLE "AiRequest" ADD COLUMN "provider" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeConsent_userId_purpose_key" ON "KnowledgeConsent"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "KnowledgeConsent" ADD CONSTRAINT "KnowledgeConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (boshqa jadvallar kabi)
ALTER TABLE "KnowledgeConsent" ENABLE ROW LEVEL SECURITY;
