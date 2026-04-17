-- Seed data for Neon PostgreSQL (FileyCare Worker)
-- 1) Create tables first: run prisma/schema-neon.sql in Neon SQL Editor
-- 2) Then run this file (seed.sql), or: psql $DATABASE_URL -f prisma/seed.sql
-- Password for all seeded users: password123
-- Extra admin for audit/manager workflows: manager@fileycare.com (sign in at /manager/login or /login)

BEGIN;

-- Bcrypt hash for "password123" (10 rounds, bcryptjs)
-- Columns: omit hourlyRate/rateCardId so this works with or without those columns on User
INSERT INTO "User" (id, email, "passwordHash", name, phone, role, qualifications, active, "createdAt", "updatedAt")
VALUES
  ('seed_admin', 'admin@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Admin User', NULL, 'ADMIN'::"Role", NULL, true, NOW(), NOW()),
  ('seed_manager_admin', 'manager@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Audit Manager', NULL, 'ADMIN'::"Role", NULL, true, NOW(), NOW()),
  ('seed_w1', 'worker@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Jane Care Worker', '07700 900000', 'CARE_WORKER'::"Role", 'NVQ Level 2', true, NOW(), NOW()),
  ('seed_w2', 'worker2@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Bob Support', '07700 900002', 'CARE_WORKER'::"Role", 'NVQ Level 3', true, NOW(), NOW()),
  ('seed_w3', 'worker3@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Priya Sharma', '07700 900003', 'CARE_WORKER'::"Role", 'NVQ Level 2', true, NOW(), NOW()),
  ('seed_w4', 'worker4@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Mike Johnson', '07700 900004', 'CARE_WORKER'::"Role", 'NVQ Level 3', true, NOW(), NOW()),
  ('seed_w5', 'worker5@fileycare.com', '$2b$10$2Xbe3ls5LfhdIaLCYWk0SuU.E0rUhR9adzKQxffjqPVO0jeia1PDe', 'Sarah Williams', '07700 900005', 'CARE_WORKER'::"Role", 'NVQ Level 2', true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  qualifications = EXCLUDED.qualifications,
  "updatedAt" = NOW();

INSERT INTO "Property" (id, name, address, "createdAt", "updatedAt")
VALUES
  ('seed-property-1', 'Filey Care Home', '1 Care Home Lane, Filey', NOW(), NOW()),
  ('seed-property-2', 'Supported Living North', '2 Supported Living Rd, Filey', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "ServiceUser" (id, name, "dateOfBirth", address, "propertyId", allergies, "medicalNotes", "emergencyContactName", "emergencyContactPhone", "careNeedsLevel", "createdAt", "updatedAt")
VALUES
  ('seed-service-user-1', 'John Smith', '1950-05-15', '1 Care Home Lane, Filey', 'seed-property-1', 'Penicillin', 'Mobility support required.', 'Mary Smith', '07700 900001', 'medium', NOW(), NOW()),
  ('seed-service-user-2', 'Alice Brown', '1962-08-20', '2 Supported Living Rd, Filey', 'seed-property-2', 'None', 'Diabetes – monitor blood sugar.', 'Tom Brown', '07700 900003', 'high', NOW(), NOW()),
  ('seed-service-user-3', 'Fred Wilson', '1948-12-10', '1 Care Home Lane, Filey', 'seed-property-1', 'None', 'Light support.', 'Jean Wilson', '07700 900004', 'low', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Shifts (sample: yesterday and today, 5 workers × 2 days = 10 shifts)
INSERT INTO "Shift" (id, "careWorkerId", "serviceUserId", "propertyId", "startAt", "endAt", status, notes, "createdAt", "updatedAt")
SELECT
  'seed_shift_' || n,
  (ARRAY['seed_w1','seed_w2','seed_w3','seed_w4','seed_w5'])[1 + ((n - 1) % 5)],
  (ARRAY['seed-service-user-1','seed-service-user-2','seed-service-user-3'])[1 + ((n - 1) % 3)],
  (ARRAY['seed-property-1','seed-property-2','seed-property-1'])[1 + ((n - 1) % 3)],
  (CURRENT_DATE + ((n - 1) / 5) * INTERVAL '1 day') + TIME '08:00',
  (CURRENT_DATE + ((n - 1) / 5) * INTERVAL '1 day') + TIME '16:00',
  (CASE WHEN n <= 5 THEN 'COMPLETED' ELSE 'SCHEDULED' END)::"ShiftStatus",
  'Care shift',
  NOW(),
  NOW()
FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;

-- Journal entries for completed shifts
INSERT INTO "JournalEntry" (id, "shiftId", "careWorkerId", category, content, "recordedAt", "createdAt")
SELECT
  'seed_journal_' || row_number() OVER (),
  s.id,
  s."careWorkerId",
  'ROUTINE'::"JournalCategory",
  'Care tasks completed. Client comfortable.',
  s."endAt",
  NOW()
FROM "Shift" s
WHERE s.status = 'COMPLETED' AND s.id LIKE 'seed_shift_%'
ON CONFLICT (id) DO NOTHING;

-- Time records for completed shifts (property mandatory)
INSERT INTO "TimeRecord" (id, "userId", "propertyId", "shiftType", "clockInAt", "clockOutAt", "breakMinutes", "totalMinutes", "approvalStatus", "createdAt", "updatedAt")
SELECT
  'seed_time_' || row_number() OVER (),
  s."careWorkerId",
  s."propertyId",
  'STANDARD'::"ShiftType",
  s."startAt",
  s."endAt",
  30,
  450,
  'APPROVED'::"TimeRecordApproval",
  NOW(),
  NOW()
FROM "Shift" s
WHERE s.status = 'COMPLETED' AND s.id LIKE 'seed_shift_%' AND s."propertyId" IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Incidents
INSERT INTO "IncidentReport" (id, "serviceUserId", "careWorkerId", severity, status, description, "actionTaken", "followUpNotes", "occurredAt", "createdAt", "updatedAt")
VALUES
  ('seed_incident_1', 'seed-service-user-1', 'seed_w1', 'LOW'::"IncidentSeverity", 'RESOLVED'::"IncidentStatus", 'Minor trip in hallway. No injury.', 'Checked for injury, incident form completed.', 'Risk assessment reviewed.', NOW() - INTERVAL '2 days', NOW(), NOW()),
  ('seed_incident_2', 'seed-service-user-2', 'seed_w3', 'LOW'::"IncidentSeverity", 'RESOLVED'::"IncidentStatus", 'Medication given 10 min late. Noted.', 'Apology to family. Process reviewed.', 'No recurrence.', NOW() - INTERVAL '1 day', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Care plan
INSERT INTO "CarePlan" (id, "serviceUserId", title, goals, interventions, "reviewDate", status, "createdAt", "updatedAt")
VALUES ('seed_careplan_1', 'seed-service-user-1', 'Personal care and mobility', 'Maintain independence with daily activities. Support mobility and medication.', 'Daily support with washing, dressing. Prompt medication. Encourage gentle exercise.', CURRENT_DATE + 90, 'ACTIVE'::"CarePlanStatus", NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Audit template example: Blood Pressure Monitor Diary
INSERT INTO "AuditFormTemplate" (id, name, description, category, fields, "isSystem", "isActive", "createdAt", "updatedAt")
VALUES (
  'seed_audit_template_bp',
  'Blood Pressure Monitor Diary',
  'NHS-style blood pressure diary with AM/PM readings and pulse tracking.',
  'Health Monitoring',
  '[
    {"key":"service_user_name","label":"Service User Name","type":"TEXT","required":true},
    {"key":"date_of_birth","label":"Date of Birth","type":"DATE"},
    {"key":"instructions","label":"Take at least 2 readings morning and evening for 7 days.","type":"SECTION_HEADER"},
    {"key":"bp_readings","label":"Blood Pressure Readings","type":"TABLE_GRID","defaultRows":0,"columns":[
      {"key":"date","label":"Date","type":"DATE"},
      {"key":"time_of_day","label":"AM/PM","type":"DROPDOWN","options":["AM","PM"]},
      {"key":"bp1","label":"1st BP (mmHg)","type":"TEXT"},
      {"key":"pulse1","label":"1st Pulse","type":"NUMBER"},
      {"key":"bp2","label":"2nd BP (mmHg)","type":"TEXT"},
      {"key":"pulse2","label":"2nd Pulse","type":"NUMBER"},
      {"key":"comments","label":"Comments","type":"TEXT"}
    ]}
  ]'::jsonb,
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "aiAssistantPrompt" TEXT;
ALTER TABLE "AuditFormTemplate" ADD COLUMN IF NOT EXISTS "templateCode" TEXT;

UPDATE "AuditFormTemplate"
SET "templateCode" = 'blood_pressure_monitor_diary'
WHERE id = 'seed_audit_template_bp' AND ("templateCode" IS NULL OR "templateCode" = '');

UPDATE "AuditFormTemplate"
SET "aiAssistantPrompt" = 'This section is for structured readings taken at a sitting (e.g. home BP style).

When staff describe what happened in plain language, map values into the row fields only when they can be inferred without any person''s name, address, NHS number, or date of birth. Use ISO date yyyy-mm-dd for the reading date when mentioned; AM/PM from context; blood pressure as systolic/diastolic with a slash (e.g. 128/82); pulse as a whole number.

If the text mentions feeling unwell, chest pain, severe headache, confusion, or very high/low numbers, add non-diagnostic suggested_actions (e.g. follow local escalation policy, seek urgent clinical advice if unwell) and short concerns. Ask clarifying questions in questions_for_staff only about the measurement context (rested, after activity, device), not about identity.'
WHERE id = 'seed_audit_template_bp';

COMMIT;
