-- Audit template filing frequency + change history (PostgreSQL / Neon).
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "filingFrequency" "AuditScheduleFrequency" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "monthlyFilingDueDay" INTEGER;

CREATE TABLE IF NOT EXISTS "AuditFormTemplateChangeLog" (
    "id" TEXT NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "changedById" TEXT,
    "versionAfter" INTEGER NOT NULL,
    "summaryLine" TEXT NOT NULL,
    "changesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditFormTemplateChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditFormTemplateChangeLog_formTemplateId_createdAt_idx"
ON "AuditFormTemplateChangeLog"("formTemplateId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditFormTemplateChangeLog_formTemplateId_fkey'
  ) THEN
    ALTER TABLE "AuditFormTemplateChangeLog"
      ADD CONSTRAINT "AuditFormTemplateChangeLog_formTemplateId_fkey"
      FOREIGN KEY ("formTemplateId") REFERENCES "AuditFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditFormTemplateChangeLog_changedById_fkey'
  ) THEN
    ALTER TABLE "AuditFormTemplateChangeLog"
      ADD CONSTRAINT "AuditFormTemplateChangeLog_changedById_fkey"
      FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
