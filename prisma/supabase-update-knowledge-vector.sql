-- AI Bilim markazi, IXTIYORIY vektorli qidiruv (pgvector). Faqat qo'shimcha; istalgancha marta ishga tushirish mumkin.
-- Ishlatish (o'z terminalingizda, supabase-update-knowledge-base.sql dan KEYIN): npx tsx --env-file=.env.local prisma/apply-sql.ts prisma/supabase-update-knowledge-vector.sql
-- Bu fayl qo'llanmasa ham hamma narsa ishlaydi: qidiruv kalit so'zlar bilan (rag.ts). Vektor qidiruvi faqat shu jadval bor va embedding kaliti (GEMINI_API_KEY) ulangan bo'lsa yoqiladi.
-- O'lcham 768: KNOWLEDGE_EMBED_DIMS bilan bir xil bo'lishi shart (o'zgartirsangiz jadval qayta yaratiladi).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS "KnowledgeEmbedding" (
    "knowledgeId" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "searchMetadata" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeEmbedding_pkey" PRIMARY KEY ("knowledgeId"),
    CONSTRAINT "KnowledgeEmbedding_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "KnowledgeEmbedding_embedding_idx" ON "KnowledgeEmbedding" USING hnsw ("embedding" vector_cosine_ops);
ALTER TABLE "KnowledgeEmbedding" ENABLE ROW LEVEL SECURITY;
