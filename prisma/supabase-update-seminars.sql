-- Seminarlar jadvali. Xavfsiz: istalgancha marta ishga tushirish mumkin.
CREATE TABLE IF NOT EXISTS "Seminar" ("id" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "speaker" TEXT, "startsAt" TIMESTAMP(3) NOT NULL, "durationMin" INTEGER, "place" TEXT, "link" TEXT, "capacity" INTEGER, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Seminar_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Seminar_startsAt_idx" ON "Seminar"("startsAt");
ALTER TABLE "Seminar" ENABLE ROW LEVEL SECURITY;