import {
  getBlockingAuditFieldIssues,
  type BlockingIssueField,
} from "@/lib/audit-field-vitals";
import { getTimingBlockingIssues } from "@/lib/audit-form-timing-validation";
import { normalizeDateInputForStorage } from "@/lib/audit-form-dates";
import { getAgeYearsFromIso } from "@/lib/audit-vitals-uk-age";

const AUDIT_PAYLOAD_META_KEYS = new Set([
  "__recording",
  "__vitalsActionPlan",
  "__aiFormValidation",
]);

export function stripAuditSubmissionMeta(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (AUDIT_PAYLOAD_META_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function parseTemplateFieldsJson(fieldsJson: unknown): BlockingIssueField[] {
  if (!Array.isArray(fieldsJson)) return [];
  return fieldsJson as BlockingIssueField[];
}

function valueIsEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Mirrors client required checks so the server rejects incomplete submissions with clear reasons. */
export function getRequiredFieldSubmissionIssues(
  fields: BlockingIssueField[],
  values: Record<string, unknown>
): string[] {
  const issues: string[] = [];
  for (const f of fields) {
    const fr = f as BlockingIssueField & { required?: boolean };
    if (!fr.required) continue;
    if (f.type === "SECTION_HEADER" || f.type === "INFO_TEXT") continue;
    if (f.type === "TABLE_GRID") {
      const rows = (values[f.key] as Record<string, unknown>[] | undefined) ?? [];
      if (!Array.isArray(rows) || rows.length === 0) {
        issues.push(`${f.label}: add at least one row — this section is required.`);
      }
      continue;
    }
    if (valueIsEmpty(values[f.key])) {
      issues.push(`${f.label}: this field is required.`);
    }
  }
  return issues;
}

export function getAllSubmissionBlockingIssues(
  templateName: string,
  fieldsJson: unknown,
  payload: Record<string, unknown>,
  ageYears: number | null
): string[] {
  const fields = parseTemplateFieldsJson(fieldsJson);
  const values = stripAuditSubmissionMeta(payload);
  const nameLower = templateName.toLowerCase();
  const required = getRequiredFieldSubmissionIssues(fields, values);
  const fieldIssues = getBlockingAuditFieldIssues(nameLower, fields, values, ageYears);
  const timing = getTimingBlockingIssues(fields, values);
  return [...required, ...fieldIssues, ...timing];
}

export function resolveAgeYearsForAuditSubmission(params: {
  serviceUserDob: Date | null | undefined;
  payloadValues: Record<string, unknown>;
}): number | null {
  if (params.serviceUserDob) {
    const iso = params.serviceUserDob.toISOString().slice(0, 10);
    const y = getAgeYearsFromIso(iso);
    if (y != null) return y;
  }
  const flat = params.payloadValues;
  const dobRaw = flat.date_of_birth ?? flat.dateOfBirth;
  if (typeof dobRaw === "string" && dobRaw.trim()) {
    const n = normalizeDateInputForStorage(dobRaw.trim()) || dobRaw.trim();
    return getAgeYearsFromIso(n.slice(0, 10));
  }
  return null;
}
