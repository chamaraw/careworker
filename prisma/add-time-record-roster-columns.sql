-- Run once on Postgres if Prisma expects off-roster / linked-shift fields (matches prisma/schema.prisma).
ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "offRosterReason" TEXT;
ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "linkedShiftId" TEXT;
ALTER TABLE "TimeRecord" DROP CONSTRAINT IF EXISTS "TimeRecord_linkedShiftId_fkey";
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_linkedShiftId_fkey"
  FOREIGN KEY ("linkedShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
