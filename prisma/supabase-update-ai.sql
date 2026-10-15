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
