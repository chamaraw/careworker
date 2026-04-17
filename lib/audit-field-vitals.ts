/**
 * Indicative vitals for audit/recording UX only — not a clinical decision tool.
 * Age-stratified bands use `audit-vitals-uk-age.ts` (UK screening-style hints).
 */

import {
  classifyBloodPressure,
  classifyPulse,
  getUkVitalsThresholdsForAge,
} from "./audit-vitals-uk-age";
import { isValidUkDateInput, UK_DATE_PLACEHOLDER } from "./audit-form-dates";

export type VitalsTone = "neutral" | "normal" | "low" | "high" | "urgent" | "unknown";

export type VitalsAssessment = {
  tone: VitalsTone;
  /** Short label for inline UI */
  label: string;
};

export { getUkVitalsThresholdsForAge };

const DISCLAIMER_SHORT =
  "Indicative age-based UK screening hints only — follow local policy and clinical advice.";

export function vitalsDisclaimer(): string {
  return DISCLAIMER_SHORT;
}

/** Typical adult clinic-style bands for diary hints */
export function assessBloodPressureReading(raw: string, ageYears: number | null = null): VitalsAssessment {
  if (!raw.trim()) return { tone: "neutral", label: "" };
  const c = classifyBloodPressure(raw, ageYears);
  if (c.kind === "invalid") return { tone: "unknown", label: c.detail ?? "Check format e.g. 120/80" };
  if (c.kind === "empty") return { tone: "neutral", label: "" };
  if (c.kind === "ok") {
    const t = getUkVitalsThresholdsForAge(ageYears);
    return { tone: "normal", label: `Within screening range (${t.ageLabel.split("(")[0].trim()})` };
  }
  if (c.kind === "urgent") return { tone: "urgent", label: c.detail ?? "Very high BP — seek urgent advice if unwell" };
  if (c.kind === "low") return { tone: "low", label: c.detail ?? "Low BP for age — seek advice if symptomatic" };
  return { tone: "high", label: c.detail ?? "Raised BP for age — follow local policy" };
}

export function assessPulseBpm(raw: string, ageYears: number | null = null): VitalsAssessment {
  const s = raw.trim();
  if (!s) return { tone: "neutral", label: "" };
  const c = classifyPulse(s, ageYears);
  if (c.kind === "invalid") return { tone: "unknown", label: c.detail ?? "Enter a whole number (bpm)" };
  if (c.kind === "empty") return { tone: "neutral", label: "" };
  if (c.kind === "ok") {
    const t = getUkVitalsThresholdsForAge(ageYears);
    return { tone: "normal", label: `Typical resting pulse band for ${t.ageLabel.split("(")[0].trim()}` };
  }
  if (c.kind === "urgent") return { tone: "urgent", label: c.detail ?? "Pulse outside safe screening window" };
  if (c.kind === "low") return { tone: "low", label: c.detail ?? "Low pulse" };
  return { tone: "high", label: c.detail ?? "High pulse at rest" };
}

export function assessNumericRange(
  raw: string,
  min: number,
  max: number,
  unitLabel: string
): VitalsAssessment {
  const s = raw.trim();
  if (!s) return { tone: "neutral", label: "" };
  const n = Number(s);
  if (!Number.isFinite(n)) return { tone: "unknown", label: "Enter a number" };
  if (n < min) return { tone: "low", label: `Below typical ${unitLabel} (${min}–${max})` };
  if (n > max) return { tone: "high", label: `Above typical ${unitLabel} (${min}–${max})` };
  return { tone: "normal", label: `Within typical ${unitLabel} (${min}–${max})` };
}

export type ColumnLike = {
  key: string;
  label: string;
  type: string;
  /** Optional template metadata from form builder — when set, NUMBER cells use this range */
  normalMin?: number;
  normalMax?: number;
  unit?: string;
};

export function columnLooksLikeBp(col: ColumnLike): boolean {
  const k = col.key.toLowerCase();
  const l = col.label.toLowerCase();
  if (k.includes("bp") || k.includes("blood_pressure") || k.includes("bloodpressure")) return true;
  if ((l.includes("bp") || l.includes("blood pressure")) && l.includes("mmhg")) return true;
  if (l.includes("1st bp") || l.includes("2nd bp")) return true;
  return false;
}

export function columnLooksLikePulse(col: ColumnLike): boolean {
  const k = col.key.toLowerCase();
  const l = col.label.toLowerCase();
  return k.includes("pulse") || k.includes("hr") || l.includes("pulse") || l.includes("heart rate");
}

function assessBpMisconfiguredNumberColumn(raw: string, ageYears: number | null): VitalsAssessment {
  const s = raw.trim();
  if (!s) return { tone: "neutral", label: "" };
  if (s.includes("/")) return assessBloodPressureReading(raw, ageYears);
  return {
    tone: "unknown",
    label: "Enter BP as systolic/diastolic with a slash, e.g. 120/80 mmHg.",
  };
}

export function assessDateFieldValue(raw: string): VitalsAssessment {
  const s = raw.trim();
  if (!s) return { tone: "neutral", label: "" };
  if (isValidUkDateInput(s)) return { tone: "neutral", label: "" };
  return {
    tone: "unknown",
    label: `Not a real calendar date — use the date picker or UK format (${UK_DATE_PLACEHOLDER}, e.g. 5/3/2025).`,
  };
}

export type BlockingIssueField = {
  key: string;
  label: string;
  type: string;
  columns?: ColumnLike[];
};

/** Scoped issue for inline “cannot save” hints on inputs. */
export type AuditFormatBlockingIssue = {
  fieldKey: string;
  rowIndex: number | null;
  columnKey: string | null;
  pathLabel: string;
  message: string;
};

/** Non-empty cells that fail format/range (blocks submit), with stable keys for inline UI. */
export function getBlockingAuditFieldIssuesStructured(
  templateNameLower: string,
  fields: BlockingIssueField[],
  values: Record<string, unknown>,
  ageYears: number | null
): AuditFormatBlockingIssue[] {
  const issues: AuditFormatBlockingIssue[] = [];

  for (const f of fields) {
    if (f.type === "SECTION_HEADER" || f.type === "INFO_TEXT") continue;

    if (f.type === "TABLE_GRID" && f.columns) {
      const rows = (values[f.key] as Record<string, unknown>[] | undefined) ?? [];
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        for (const col of f.columns) {
          const str = row[col.key] == null ? "" : String(row[col.key]);
          const trimmed = str.trim();
          if (!trimmed) continue;

          const pathLabel = `${f.label} · row ${idx + 1} · ${col.label}`;

          if (col.type === "DATE") {
            if (!isValidUkDateInput(trimmed)) {
              issues.push({
                fieldKey: f.key,
                rowIndex: idx,
                columnKey: col.key,
                pathLabel,
                message: "invalid date.",
              });
            }
            continue;
          }
          if (col.type === "DROPDOWN" || col.type === "YES_NO") continue;

          const v = assessTableCell(templateNameLower, col, row[col.key], ageYears);
          if (v.tone === "unknown" && v.label) {
            issues.push({
              fieldKey: f.key,
              rowIndex: idx,
              columnKey: col.key,
              pathLabel,
              message: v.label,
            });
          }
        }
      }
      continue;
    }

    if (f.type === "DATE") {
      const str = String(values[f.key] ?? "").trim();
      if (str && !isValidUkDateInput(str)) {
        issues.push({
          fieldKey: f.key,
          rowIndex: null,
          columnKey: null,
          pathLabel: f.label,
          message: "enter a valid calendar date.",
        });
      }
      continue;
    }

    if (f.type === "NUMBER" || f.type === "TEXT" || f.type === "TEXTAREA") {
      const str = values[f.key] == null ? "" : String(values[f.key]);
      if (!str.trim()) continue;
      const v = assessTopLevelField(templateNameLower, f, values[f.key], ageYears);
      if (v.tone === "unknown" && v.label) {
        issues.push({
          fieldKey: f.key,
          rowIndex: null,
          columnKey: null,
          pathLabel: f.label,
          message: v.label,
        });
      }
    }
  }

  return issues;
}

/** Non-empty cells that fail format/range (blocks submit). */
export function getBlockingAuditFieldIssues(
  templateNameLower: string,
  fields: BlockingIssueField[],
  values: Record<string, unknown>,
  ageYears: number | null
): string[] {
  return getBlockingAuditFieldIssuesStructured(templateNameLower, fields, values, ageYears).map(
    (i) => `${i.pathLabel}: ${i.message}`
  );
}

export function assessTableCell(
  _templateNameLower: string,
  col: ColumnLike,
  value: unknown,
  ageYears: number | null = null
): VitalsAssessment {
  const str = value === undefined || value === null ? "" : String(value);
  const colBp = columnLooksLikeBp(col);
  const colPulse = columnLooksLikePulse(col);

  // Pulse before BP so numeric “Pulse” columns are not treated as BP just because the template title mentions BP.
  if (colPulse && (col.type === "NUMBER" || col.type === "TEXT")) {
    return assessPulseBpm(str, ageYears);
  }

  if (colBp && col.type === "NUMBER") {
    return assessBpMisconfiguredNumberColumn(str, ageYears);
  }

  if (
    col.type === "NUMBER" &&
    typeof col.normalMin === "number" &&
    typeof col.normalMax === "number"
  ) {
    return assessNumericRange(str, col.normalMin, col.normalMax, col.unit ?? "range");
  }

  if (col.type === "NUMBER" || col.type === "TEXT" || col.type === "TEXTAREA") {
    if (colBp && (col.type === "TEXT" || col.type === "TEXTAREA")) {
      return assessBloodPressureReading(str, ageYears);
    }
  }

  return { tone: "neutral", label: "" };
}

export function assessTopLevelField(
  _templateNameLower: string,
  field: { key: string; label: string; type: string },
  value: unknown,
  ageYears: number | null = null
): VitalsAssessment {
  const str = value === undefined || value === null ? "" : String(value);
  const col = { key: field.key, label: field.label, type: field.type };

  if (field.type === "NUMBER" && columnLooksLikeBp(col)) {
    return assessBpMisconfiguredNumberColumn(str, ageYears);
  }

  if ((field.type === "NUMBER" || field.type === "TEXT") && columnLooksLikePulse(col)) {
    return assessPulseBpm(str, ageYears);
  }
  if ((field.type === "TEXT" || field.type === "TEXTAREA") && columnLooksLikeBp(col)) {
    return assessBloodPressureReading(str, ageYears);
  }

  return { tone: "neutral", label: "" };
}

export type VitalActionPlanEntry = {
  path: string;
  level: "elevated" | "urgent" | "low";
  message: string;
  recheckHours: number;
};

export type FieldLikeForScan = {
  key: string;
  label: string;
  type: string;
  columns?: ColumnLike[];
};

/** Collect abnormal vitals for post-entry action plan (before submit). */
export function collectVitalActionPlanFindings(
  templateNameLower: string,
  fields: FieldLikeForScan[],
  values: Record<string, unknown>,
  ageYears: number | null
): VitalActionPlanEntry[] {
  const t = getUkVitalsThresholdsForAge(ageYears);
  const out: VitalActionPlanEntry[] = [];

  for (const f of fields) {
    if (f.type === "TABLE_GRID" && f.columns) {
      const rows = (values[f.key] as Record<string, unknown>[] | undefined) ?? [];
      rows.forEach((row, idx) => {
        for (const col of f.columns!) {
          if (col.type === "DATE" || col.type === "DROPDOWN" || col.type === "YES_NO") continue;
          const str = row[col.key] == null ? "" : String(row[col.key]);
          if (!str.trim()) continue;
          const path = `${f.label} · row ${idx + 1} · ${col.label}`;
          const looksBp =
            templateNameLower.includes("blood pressure") ||
            columnLooksLikeBp(col) ||
            (col.key.toLowerCase().includes("bp") &&
              (col.type === "TEXT" || col.type === "NUMBER"));
          if (
            looksBp &&
            (col.type === "TEXT" ||
              col.type === "TEXTAREA" ||
              col.type === "NUMBER" ||
              col.label.toLowerCase().includes("mmhg"))
          ) {
            const c = classifyBloodPressure(str, ageYears);
            if (c.kind === "elevated")
              out.push({
                path,
                level: "elevated",
                message: c.detail ?? "Raised BP",
                recheckHours: t.recheckHoursElevatedBp,
              });
            else if (c.kind === "urgent")
              out.push({
                path,
                level: "urgent",
                message: c.detail ?? "Very high BP",
                recheckHours: t.recheckHoursElevatedBp,
              });
            else if (c.kind === "low")
              out.push({
                path,
                level: "low",
                message: c.detail ?? "Low BP",
                recheckHours: t.recheckHoursElevatedBp,
              });
          } else if (columnLooksLikePulse(col) && (col.type === "NUMBER" || col.type === "TEXT")) {
            const c = classifyPulse(str, ageYears);
            if (c.kind === "elevated")
              out.push({
                path,
                level: "elevated",
                message: c.detail ?? "Raised pulse",
                recheckHours: t.recheckHoursElevatedPulse,
              });
            else if (c.kind === "urgent")
              out.push({
                path,
                level: "urgent",
                message: c.detail ?? "Pulse concern",
                recheckHours: t.recheckHoursElevatedPulse,
              });
            else if (c.kind === "low")
              out.push({
                path,
                level: "low",
                message: c.detail ?? "Low pulse",
                recheckHours: t.recheckHoursElevatedPulse,
              });
          }
        }
      });
    }

    if (f.type === "TEXT" || f.type === "TEXTAREA" || f.type === "NUMBER") {
      const str = values[f.key] == null ? "" : String(values[f.key]);
      if (!str.trim()) continue;
      const pseudo = { key: f.key, label: f.label, type: f.type };
      if ((f.type === "NUMBER" || f.type === "TEXT") && columnLooksLikePulse(pseudo)) {
        const c = classifyPulse(str, ageYears);
        const path = f.label;
        if (c.kind === "elevated")
          out.push({
            path,
            level: "elevated",
            message: c.detail ?? "Raised pulse",
            recheckHours: t.recheckHoursElevatedPulse,
          });
        else if (c.kind === "urgent")
          out.push({ path, level: "urgent", message: c.detail ?? "Pulse concern", recheckHours: t.recheckHoursElevatedPulse });
        else if (c.kind === "low")
          out.push({ path, level: "low", message: c.detail ?? "Low pulse", recheckHours: t.recheckHoursElevatedPulse });
      }
      if (
        (f.type === "TEXT" || f.type === "TEXTAREA" || f.type === "NUMBER") &&
        (templateNameLower.includes("blood pressure") || columnLooksLikeBp(pseudo))
      ) {
        const c = classifyBloodPressure(str, ageYears);
        const path = f.label;
        if (c.kind === "elevated")
          out.push({
            path,
            level: "elevated",
            message: c.detail ?? "Raised BP",
            recheckHours: t.recheckHoursElevatedBp,
          });
        else if (c.kind === "urgent")
          out.push({ path, level: "urgent", message: c.detail ?? "Very high BP", recheckHours: t.recheckHoursElevatedBp });
        else if (c.kind === "low")
          out.push({ path, level: "low", message: c.detail ?? "Low BP", recheckHours: t.recheckHoursElevatedBp });
      }
    }
  }

  return out;
}

export function toneBorderClass(tone: VitalsTone): string {
  switch (tone) {
    case "normal":
      return "border-[#007F3B]/50 focus-visible:ring-[#007F3B]/35";
    case "urgent":
      return "border-red-600/80 focus-visible:ring-red-500/40";
    case "low":
    case "high":
      return "border-amber-500/70 focus-visible:ring-amber-500/40";
    case "unknown":
      return "border-slate-400/60 focus-visible:ring-slate-400/30";
    default:
      return "";
  }
}

export function toneHintClass(tone: VitalsTone): string {
  switch (tone) {
    case "normal":
      return "text-[#007F3B]";
    case "urgent":
      return "text-red-800 font-medium";
    case "low":
    case "high":
      return "text-amber-800";
    case "unknown":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}
