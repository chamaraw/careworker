import { AUDIT_AI_ASSISTANT_SAMPLE_PROMPT } from "@/lib/audit-ai-assistant-sample";
import { auditTemplatePackSchema, type AuditTemplatePackEntryParsed } from "@/lib/audit-template-schema";
import docxImportedPack from "./docx-imported-pack.json";

/**
 * Built-in system templates (versioned in repo). Extend this array as you add forms.
 * Sync is idempotent: matches by `templateCode` when set, else by `name`.
 *
 * Order: curated forms first (structured TABLE_GRID / prompts), then DOCX-derived drafts from
 * `docx-imported-pack.json` (from `npm run docx:draft`, excluding the auto draft for BP so the curated diary wins).
 */
const CURATED_AUDIT_TEMPLATE_PACK: unknown[] = [
  {
    templateCode: "blood_pressure_monitor_diary",
    name: "Blood Pressure Monitor Diary",
    category: "Health Monitoring",
    description: "NHS-style blood pressure diary with AM/PM readings and pulse tracking.",
    useBpSampleAiPrompt: true,
    fields: [
      { key: "service_user_name", label: "Service User Name", type: "TEXT", required: true },
      { key: "date_of_birth", label: "Date of Birth", type: "DATE" },
      {
        key: "instructions",
        label: "Take at least 2 readings morning and evening for 7 days.",
        type: "SECTION_HEADER",
      },
      {
        key: "bp_readings",
        label: "Blood Pressure Readings",
        type: "TABLE_GRID",
        defaultRows: 14,
        columns: [
          { key: "date", label: "Date", type: "DATE" },
          { key: "time_of_day", label: "AM/PM", type: "DROPDOWN", options: ["AM", "PM"] },
          { key: "bp1", label: "1st BP (mmHg)", type: "TEXT" },
          { key: "pulse1", label: "1st Pulse", type: "NUMBER" },
          { key: "bp2", label: "2nd BP (mmHg)", type: "TEXT" },
          { key: "pulse2", label: "2nd Pulse", type: "NUMBER" },
          { key: "comments", label: "Comments", type: "TEXT" },
        ],
      },
    ],
  },
  {
    templateCode: "medication_administration_audit",
    name: "Medication Administration Audit",
    category: "Medication",
    description: "Checks MAR completion, omissions, signatures and stock control.",
    fields: [
      { key: "audit_date", label: "Audit Date", type: "DATE", required: true },
      { key: "auditor", label: "Auditor Name", type: "TEXT", required: true },
      { key: "mar_complete", label: "MAR charts complete and legible?", type: "YES_NO", required: true },
      { key: "omissions_documented", label: "Omissions documented correctly?", type: "YES_NO", required: true },
      { key: "controlled_drugs", label: "Controlled drugs checks in place?", type: "YES_NO" },
      { key: "actions_required", label: "Actions Required", type: "TEXTAREA" },
    ],
  },
  {
    templateCode: "daily_environment_safety_check",
    name: "Daily Environment Safety Check",
    category: "Environment",
    description: "Quick check for hazards, fire routes and equipment safety.",
    assignmentScope: "GLOBAL",
    fields: [
      { key: "check_date", label: "Check Date", type: "DATE", required: true },
      { key: "fire_exits_clear", label: "Fire exits clear?", type: "YES_NO", required: true },
      { key: "trip_hazards", label: "Any trip hazards identified?", type: "YES_NO", required: true },
      { key: "equipment_safe", label: "Equipment visually safe?", type: "YES_NO", required: true },
      { key: "hazard_details", label: "Hazard details", type: "TEXTAREA" },
    ],
  },
];

const SYSTEM_AUDIT_TEMPLATE_PACK_INPUT: unknown[] = [
  ...CURATED_AUDIT_TEMPLATE_PACK,
  ...(docxImportedPack as unknown[]),
];

let cachedPack: AuditTemplatePackEntryParsed[] | null = null;

/** Validated system pack (throws at startup if pack JSON is invalid). */
export function getSystemAuditTemplatePack(): AuditTemplatePackEntryParsed[] {
  if (cachedPack) return cachedPack;
  const parsed = auditTemplatePackSchema.safeParse(SYSTEM_AUDIT_TEMPLATE_PACK_INPUT);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Invalid SYSTEM_AUDIT_TEMPLATE_PACK_INPUT: ${msg}`);
  }
  cachedPack = parsed.data;
  return cachedPack;
}

export function resolvePackEntryAiPrompt(entry: AuditTemplatePackEntryParsed): string | null {
  if (entry.useBpSampleAiPrompt) return AUDIT_AI_ASSISTANT_SAMPLE_PROMPT;
  return null;
}
