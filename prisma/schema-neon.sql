-- FileyCare Worker – PostgreSQL schema export (Neon / any Postgres)
-- Run in Neon SQL Editor, or: psql $DATABASE_URL -f prisma/schema-neon.sql
-- Safe to run multiple times: creates missing objects, adds missing columns to existing tables.
-- Then run seed: psql $DATABASE_URL -f prisma/seed.sql  (or npm run db:seed)

CREATE SCHEMA IF NOT EXISTS "public";

-- Enums
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'CARE_WORKER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalCategory" AS ENUM ('ROUTINE', 'MEDICATION', 'BEHAVIOR', 'MEAL', 'PERSONAL_CARE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TimeRecordApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CarePlanStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShiftType" AS ENUM ('STANDARD', 'LONE_WORKING', 'SLEEP_NIGHT', 'AWAKE_NIGHT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Add AWAKE_NIGHT to existing enum if it was created without it
DO $$ BEGIN
  ALTER TYPE "ShiftType" ADD VALUE 'AWAKE_NIGHT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RateType" AS ENUM ('HOURLY', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Housing / H&S / maintenance / service charges
DO $$ BEGIN
  CREATE TYPE "HsCheckKind" AS ENUM ('GAS_SAFETY', 'ELECTRICAL', 'FIRE_SAFETY', 'LEGIONELLA', 'GENERAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HsInspectionInstanceStatus" AS ENUM ('DUE', 'COMPLETED', 'OVERDUE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenanceTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceChargeFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceChargePaymentStatus" AS ENUM ('DUE', 'PARTIAL', 'PAID', 'OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "role" "Role" NOT NULL DEFAULT 'CARE_WORKER',
  "qualifications" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "hourlyRate" DOUBLE PRECISION,
  "rateCardId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Property" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3),
  "address" TEXT,
  "propertyId" TEXT,
  "allergies" TEXT,
  "medicalNotes" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "careNeedsLevel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Shift" (
  "id" TEXT NOT NULL,
  "careWorkerId" TEXT NOT NULL,
  "serviceUserId" TEXT NOT NULL,
  "propertyId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JournalEntry" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "category" "JournalCategory" NOT NULL,
  "content" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "careWorkerId" TEXT NOT NULL,
  CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TimeRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "shiftType" "ShiftType" NOT NULL DEFAULT 'STANDARD',
  "clockInAt" TIMESTAMP(3) NOT NULL,
  "clockOutAt" TIMESTAMP(3),
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "totalMinutes" INTEGER,
  "approvalStatus" "TimeRecordApproval" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimeRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateCard" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateCardRule" (
  "id" TEXT NOT NULL,
  "rateCardId" TEXT NOT NULL,
  "shiftType" "ShiftType" NOT NULL,
  "rateType" "RateType" NOT NULL DEFAULT 'HOURLY',
  "hourlyRate" DOUBLE PRECISION,
  "fixedAmount" DOUBLE PRECISION,
  "bonusHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "RateCardRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserRateOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shiftType" "ShiftType" NOT NULL,
  "rateType" "RateType" NOT NULL DEFAULT 'HOURLY',
  "hourlyRate" DOUBLE PRECISION,
  "fixedAmount" DOUBLE PRECISION,
  "bonusHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "UserRateOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncidentReport" (
  "id" TEXT NOT NULL,
  "serviceUserId" TEXT NOT NULL,
  "careWorkerId" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT NOT NULL,
  "actionTaken" TEXT,
  "followUpNotes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FollowUpAction" (
  "id" TEXT NOT NULL,
  "serviceUserId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "incidentId" TEXT,
  "createdById" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FollowUpAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CarePlan" (
  "id" TEXT NOT NULL,
  "serviceUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "goals" TEXT,
  "interventions" TEXT,
  "reviewDate" TIMESTAMP(3),
  "status" "CarePlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarNote" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "content" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT,
  "link" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Update existing tables: add missing columns (safe when tables already exist from an older schema)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hourlyRate" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rateCardId" TEXT;

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "postcode" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "communalAreasNotes" TEXT;

ALTER TABLE "ServiceUser" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

CREATE TABLE IF NOT EXISTS "PropertyUnit" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "floor" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PropertyAsset" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HsInspectionSchedule" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "checkKind" "HsCheckKind" NOT NULL DEFAULT 'GENERAL',
  "frequency" "ServiceChargeFrequency" NOT NULL DEFAULT 'MONTHLY',
  "intervalMonths" INTEGER NOT NULL DEFAULT 12,
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HsInspectionSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HsInspection" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "HsInspectionInstanceStatus" NOT NULL DEFAULT 'DUE',
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HsInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaintenanceTask" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceTaskStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceChargeSchedule" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "frequency" "ServiceChargeFrequency" NOT NULL DEFAULT 'MONTHLY',
  "startDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceChargeSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceChargePayment" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "unitId" TEXT,
  "serviceUserId" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amountDue" DOUBLE PRECISION NOT NULL,
  "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "ServiceChargePaymentStatus" NOT NULL DEFAULT 'DUE',
  "paidAt" TIMESTAMP(3),
  "reference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceChargePayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;
ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "shiftType" "ShiftType" DEFAULT 'STANDARD';
-- If you had NULL propertyId rows, run: npx tsx prisma/backfill-time-record-property.ts
-- Then enforce NOT NULL: ALTER TABLE "TimeRecord" ALTER COLUMN "propertyId" SET NOT NULL;

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "RateCard_name_key" ON "RateCard"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "RateCardRule_rateCardId_shiftType_key" ON "RateCardRule"("rateCardId", "shiftType");
CREATE UNIQUE INDEX IF NOT EXISTS "UserRateOverride_userId_shiftType_key" ON "UserRateOverride"("userId", "shiftType");

-- Foreign keys
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_rateCardId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceUser" DROP CONSTRAINT IF EXISTS "ServiceUser_propertyId_fkey";
ALTER TABLE "ServiceUser" ADD CONSTRAINT "ServiceUser_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_careWorkerId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_careWorkerId_fkey" FOREIGN KEY ("careWorkerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_serviceUserId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "ServiceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Shift" DROP CONSTRAINT IF EXISTS "Shift_propertyId_fkey";
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_shiftId_fkey";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_careWorkerId_fkey";
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_careWorkerId_fkey" FOREIGN KEY ("careWorkerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeRecord" DROP CONSTRAINT IF EXISTS "TimeRecord_userId_fkey";
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeRecord" DROP CONSTRAINT IF EXISTS "TimeRecord_propertyId_fkey";
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RateCardRule" DROP CONSTRAINT IF EXISTS "RateCardRule_rateCardId_fkey";
ALTER TABLE "RateCardRule" ADD CONSTRAINT "RateCardRule_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRateOverride" DROP CONSTRAINT IF EXISTS "UserRateOverride_userId_fkey";
ALTER TABLE "UserRateOverride" ADD CONSTRAINT "UserRateOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentReport" DROP CONSTRAINT IF EXISTS "IncidentReport_serviceUserId_fkey";
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "ServiceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentReport" DROP CONSTRAINT IF EXISTS "IncidentReport_careWorkerId_fkey";
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_careWorkerId_fkey" FOREIGN KEY ("careWorkerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUpAction" DROP CONSTRAINT IF EXISTS "FollowUpAction_serviceUserId_fkey";
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "ServiceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUpAction" DROP CONSTRAINT IF EXISTS "FollowUpAction_incidentId_fkey";
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FollowUpAction" DROP CONSTRAINT IF EXISTS "FollowUpAction_createdById_fkey";
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FollowUpAction" DROP CONSTRAINT IF EXISTS "FollowUpAction_completedById_fkey";
ALTER TABLE "FollowUpAction" ADD CONSTRAINT "FollowUpAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarePlan" DROP CONSTRAINT IF EXISTS "CarePlan_serviceUserId_fkey";
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "ServiceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarNote" DROP CONSTRAINT IF EXISTS "CalendarNote_userId_fkey";
ALTER TABLE "CalendarNote" ADD CONSTRAINT "CalendarNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_createdById_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PropertyUnit" DROP CONSTRAINT IF EXISTS "PropertyUnit_propertyId_fkey";
ALTER TABLE "PropertyUnit" ADD CONSTRAINT "PropertyUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyAsset" DROP CONSTRAINT IF EXISTS "PropertyAsset_propertyId_fkey";
ALTER TABLE "PropertyAsset" ADD CONSTRAINT "PropertyAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HsInspectionSchedule" DROP CONSTRAINT IF EXISTS "HsInspectionSchedule_propertyId_fkey";
ALTER TABLE "HsInspectionSchedule" ADD CONSTRAINT "HsInspectionSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HsInspection" DROP CONSTRAINT IF EXISTS "HsInspection_scheduleId_fkey";
ALTER TABLE "HsInspection" ADD CONSTRAINT "HsInspection_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "HsInspectionSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HsInspection" DROP CONSTRAINT IF EXISTS "HsInspection_completedById_fkey";
ALTER TABLE "HsInspection" ADD CONSTRAINT "HsInspection_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTask" DROP CONSTRAINT IF EXISTS "MaintenanceTask_propertyId_fkey";
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTask" DROP CONSTRAINT IF EXISTS "MaintenanceTask_unitId_fkey";
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTask" DROP CONSTRAINT IF EXISTS "MaintenanceTask_assignedToId_fkey";
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceChargeSchedule" DROP CONSTRAINT IF EXISTS "ServiceChargeSchedule_propertyId_fkey";
ALTER TABLE "ServiceChargeSchedule" ADD CONSTRAINT "ServiceChargeSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceChargePayment" DROP CONSTRAINT IF EXISTS "ServiceChargePayment_scheduleId_fkey";
ALTER TABLE "ServiceChargePayment" ADD CONSTRAINT "ServiceChargePayment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ServiceChargeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceChargePayment" DROP CONSTRAINT IF EXISTS "ServiceChargePayment_unitId_fkey";
ALTER TABLE "ServiceChargePayment" ADD CONSTRAINT "ServiceChargePayment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceChargePayment" DROP CONSTRAINT IF EXISTS "ServiceChargePayment_serviceUserId_fkey";
ALTER TABLE "ServiceChargePayment" ADD CONSTRAINT "ServiceChargePayment_serviceUserId_fkey" FOREIGN KEY ("serviceUserId") REFERENCES "ServiceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceUser" DROP CONSTRAINT IF EXISTS "ServiceUser_unitId_fkey";
ALTER TABLE "ServiceUser" ADD CONSTRAINT "ServiceUser_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PropertyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure at least one property exists (so propertyId need not be null)
INSERT INTO "Property" (id, name, address, "createdAt", "updatedAt")
SELECT 'default-property', 'Default Property', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Property" LIMIT 1);

-- Set any NULL TimeRecord.propertyId to the first property (keeps data valid)
UPDATE "TimeRecord"
SET "propertyId" = (SELECT id FROM "Property" ORDER BY id LIMIT 1)
WHERE "propertyId" IS NULL;

-- Enforce NOT NULL on propertyId (safe after the update above)
ALTER TABLE "TimeRecord" ALTER COLUMN "propertyId" SET NOT NULL;

-- Holiday pay boosts (global)
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

-- ===== Audit Management (full suite) =====
DO $$ BEGIN
  CREATE TYPE "AuditSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AuditActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AuditActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CqcKeyQuestion" AS ENUM ('SAFE', 'EFFECTIVE', 'CARING', 'RESPONSIVE', 'WELL_LED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CqcRating" AS ENUM ('OUTSTANDING', 'GOOD', 'REQUIRES_IMPROVEMENT', 'INADEQUATE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RiskLikelihood" AS ENUM ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RiskImpact" AS ENUM ('NEGLIGIBLE', 'MINOR', 'MODERATE', 'MAJOR', 'CATASTROPHIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATED', 'ACCEPTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AuditScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AuditTemplateAssignmentScope" AS ENUM ('GLOBAL', 'PROPERTY', 'SERVICE_USER', 'CARE_PACKAGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "AuditTemplateAssignmentScope" ADD VALUE 'CARE_PACKAGE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AuditFormTemplate" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "fields" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "basedOnTemplateId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "PropertyFormAssignment" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "formTemplateId" TEXT NOT NULL,
  "assignedTemplateVersion" INTEGER NOT NULL DEFAULT 1,
  "assignedBaseTemplateId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyFormAssignment_propertyId_formTemplateId_key" ON "PropertyFormAssignment"("propertyId","formTemplateId");

ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "basedOnTemplateId" TEXT;
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "aiAssistantPrompt" TEXT;
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "templateCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AuditFormTemplate_templateCode_key" ON "AuditFormTemplate"("templateCode") WHERE "templateCode" IS NOT NULL;
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "assignmentScope" "AuditTemplateAssignmentScope" NOT NULL DEFAULT 'PROPERTY';
ALTER TABLE "PropertyFormAssignment" ADD COLUMN IF NOT EXISTS "assignedTemplateVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PropertyFormAssignment" ADD COLUMN IF NOT EXISTS "assignedBaseTemplateId" TEXT;
ALTER TABLE "PropertyFormAssignment" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "CarePackage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CarePackage_slug_key" ON "CarePackage"("slug");

CREATE TABLE IF NOT EXISTS "CarePackageTemplate" (
  "id" TEXT NOT NULL,
  "carePackageId" TEXT NOT NULL,
  "formTemplateId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePackageTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CarePackageTemplate_carePackageId_formTemplateId_key" ON "CarePackageTemplate"("carePackageId","formTemplateId");

ALTER TABLE "ServiceUser" ADD COLUMN IF NOT EXISTS "carePackageId" TEXT;

ALTER TABLE "CarePackageTemplate" DROP CONSTRAINT IF EXISTS "CarePackageTemplate_carePackageId_fkey";
ALTER TABLE "CarePackageTemplate" ADD CONSTRAINT "CarePackageTemplate_carePackageId_fkey" FOREIGN KEY ("carePackageId") REFERENCES "CarePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarePackageTemplate" DROP CONSTRAINT IF EXISTS "CarePackageTemplate_formTemplateId_fkey";
ALTER TABLE "CarePackageTemplate" ADD CONSTRAINT "CarePackageTemplate_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "AuditFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceUser" DROP CONSTRAINT IF EXISTS "ServiceUser_carePackageId_fkey";
ALTER TABLE "ServiceUser" ADD CONSTRAINT "ServiceUser_carePackageId_fkey" FOREIGN KEY ("carePackageId") REFERENCES "CarePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AuditFormSubmission" (
  "id" TEXT PRIMARY KEY,
  "formTemplateId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "serviceUserId" TEXT,
  "submittedById" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "status" "AuditSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AuditCqcAssessment" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "assessmentDate" TIMESTAMP(3) NOT NULL,
  "assessorId" TEXT NOT NULL,
  "overallRating" "CqcRating",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AuditCqcScore" (
  "id" TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL,
  "keyQuestion" "CqcKeyQuestion" NOT NULL,
  "subArea" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "findings" TEXT,
  "actionsRequired" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AuditAction" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "assessmentId" TEXT,
  "submissionId" TEXT,
  "riskEntryId" TEXT,
  "incidentId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "description" TEXT NOT NULL,
  "assignedToId" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "AuditActionStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "AuditActionPriority" NOT NULL DEFAULT 'MEDIUM',
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "RiskRegisterEntry" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "likelihood" "RiskLikelihood" NOT NULL,
  "impact" "RiskImpact" NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "currentControls" TEXT,
  "plannedActions" TEXT,
  "ownerId" TEXT,
  "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
  "reviewDate" TIMESTAMP(3),
  "lastReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "RiskIncidentLink" (
  "id" TEXT PRIMARY KEY,
  "riskEntryId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "RiskIncidentLink_riskEntryId_incidentId_key" ON "RiskIncidentLink"("riskEntryId","incidentId");

CREATE TABLE IF NOT EXISTS "ComplianceDocument" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "propertyId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "DocumentReadReceipt" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentReadReceipt_documentId_userId_key" ON "DocumentReadReceipt"("documentId","userId");

CREATE TABLE IF NOT EXISTS "TrainingRequirement" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "isMandatory" BOOLEAN NOT NULL DEFAULT true,
  "renewalMonths" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "TrainingRequirement" ADD COLUMN IF NOT EXISTS "code" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingRequirement_code_key" ON "TrainingRequirement"("code") WHERE "code" IS NOT NULL;
ALTER TABLE "TrainingRequirement" ADD COLUMN IF NOT EXISTS "appliesToAllStaff" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "CompetencyProfile" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetencyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetencyProfile_slug_key" ON "CompetencyProfile"("slug");

CREATE TABLE IF NOT EXISTS "CompetencyProfileRequirement" (
  "id" TEXT NOT NULL,
  "competencyProfileId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetencyProfileRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetencyProfileRequirement_competencyProfileId_requirementId_key" ON "CompetencyProfileRequirement"("competencyProfileId","requirementId");

CREATE TABLE IF NOT EXISTS "UserCompetencyProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "competencyProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCompetencyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserCompetencyProfile_userId_competencyProfileId_key" ON "UserCompetencyProfile"("userId","competencyProfileId");

CREATE TABLE IF NOT EXISTS "CarePackageCompetencyProfile" (
  "id" TEXT NOT NULL,
  "carePackageId" TEXT NOT NULL,
  "competencyProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePackageCompetencyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CarePackageCompetencyProfile_carePackageId_competencyProfileId_key" ON "CarePackageCompetencyProfile"("carePackageId","competencyProfileId");

ALTER TABLE "CompetencyProfileRequirement" DROP CONSTRAINT IF EXISTS "CompetencyProfileRequirement_competencyProfileId_fkey";
ALTER TABLE "CompetencyProfileRequirement" ADD CONSTRAINT "CompetencyProfileRequirement_competencyProfileId_fkey" FOREIGN KEY ("competencyProfileId") REFERENCES "CompetencyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyProfileRequirement" DROP CONSTRAINT IF EXISTS "CompetencyProfileRequirement_requirementId_fkey";
ALTER TABLE "CompetencyProfileRequirement" ADD CONSTRAINT "CompetencyProfileRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "TrainingRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCompetencyProfile" DROP CONSTRAINT IF EXISTS "UserCompetencyProfile_userId_fkey";
ALTER TABLE "UserCompetencyProfile" ADD CONSTRAINT "UserCompetencyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCompetencyProfile" DROP CONSTRAINT IF EXISTS "UserCompetencyProfile_competencyProfileId_fkey";
ALTER TABLE "UserCompetencyProfile" ADD CONSTRAINT "UserCompetencyProfile_competencyProfileId_fkey" FOREIGN KEY ("competencyProfileId") REFERENCES "CompetencyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePackageCompetencyProfile" DROP CONSTRAINT IF EXISTS "CarePackageCompetencyProfile_carePackageId_fkey";
ALTER TABLE "CarePackageCompetencyProfile" ADD CONSTRAINT "CarePackageCompetencyProfile_carePackageId_fkey" FOREIGN KEY ("carePackageId") REFERENCES "CarePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarePackageCompetencyProfile" DROP CONSTRAINT IF EXISTS "CarePackageCompetencyProfile_competencyProfileId_fkey";
ALTER TABLE "CarePackageCompetencyProfile" ADD CONSTRAINT "CarePackageCompetencyProfile_competencyProfileId_fkey" FOREIGN KEY ("competencyProfileId") REFERENCES "CompetencyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StaffTrainingRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "certificateRef" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "StaffDocumentTracker" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentRef" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "SupervisionSchedule" (
  "id" TEXT PRIMARY KEY,
  "staffId" TEXT NOT NULL,
  "supervisorId" TEXT,
  "frequency" "AuditScheduleFrequency" NOT NULL,
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "lastCompletedAt" TIMESTAMP(3),
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "filingFrequency" "AuditScheduleFrequency" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "monthlyFilingDueDay" INTEGER;

CREATE TABLE IF NOT EXISTS "AuditFormTemplateChangeLog" (
  "id" TEXT PRIMARY KEY,
  "formTemplateId" TEXT NOT NULL,
  "changedById" TEXT,
  "versionAfter" INTEGER NOT NULL,
  "summaryLine" TEXT NOT NULL,
  "changesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditFormTemplateChangeLog_formTemplateId_createdAt_idx" ON "AuditFormTemplateChangeLog"("formTemplateId", "createdAt");
ALTER TABLE "AuditFormTemplateChangeLog" DROP CONSTRAINT IF EXISTS "AuditFormTemplateChangeLog_formTemplateId_fkey";
ALTER TABLE "AuditFormTemplateChangeLog" ADD CONSTRAINT "AuditFormTemplateChangeLog_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "AuditFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditFormTemplateChangeLog" DROP CONSTRAINT IF EXISTS "AuditFormTemplateChangeLog_changedById_fkey";
ALTER TABLE "AuditFormTemplateChangeLog" ADD CONSTRAINT "AuditFormTemplateChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "offRosterReason" TEXT;
ALTER TABLE "TimeRecord" ADD COLUMN IF NOT EXISTS "linkedShiftId" TEXT;
ALTER TABLE "TimeRecord" DROP CONSTRAINT IF EXISTS "TimeRecord_linkedShiftId_fkey";
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_linkedShiftId_fkey" FOREIGN KEY ("linkedShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
