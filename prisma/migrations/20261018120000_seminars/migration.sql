-- CreateTable
CREATE TABLE "Seminar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "speaker" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "place" TEXT,
    "link" TEXT,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seminar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seminar_startsAt_idx" ON "Seminar"("startsAt");

-- RLS (boshqa jadvallar kabi)
ALTER TABLE "Seminar" ENABLE ROW LEVEL SECURITY;