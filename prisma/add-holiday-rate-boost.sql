-- Run this once on your Neon/Postgres database if you see:
--   The table public.HolidayRateBoost does not exist
--
-- Option A (recommended if you use Prisma on this machine):
--   npx prisma db push
--
-- Option B: paste and execute this script in the Neon SQL editor.

CREATE TABLE IF NOT EXISTS "HolidayRateBoost" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HolidayRateBoost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HolidayRateBoost_date_key" ON "HolidayRateBoost"("date");
