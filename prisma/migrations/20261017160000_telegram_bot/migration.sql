-- CreateTable
CREATE TABLE "TelegramLogin" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pollHash" TEXT NOT NULL,
    "userId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramUpdate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLogin_code_key" ON "TelegramLogin"("code");

-- CreateIndex
CREATE INDEX "TelegramLogin_createdAt_idx" ON "TelegramLogin"("createdAt");

-- RLS (boshqa jadvallar kabi)
ALTER TABLE "TelegramLogin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TelegramUpdate" ENABLE ROW LEVEL SECURITY;
