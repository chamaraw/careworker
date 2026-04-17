import { normalizeDateInputForStorage } from "./audit-form-dates";

export function getLondonYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getLondonHour(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(h, 10);
}

/** Dropdown / yes-no column whose options include AM and PM (any casing). */
export function isTableColumnAmPmPeriod(col: {
  key: string;
  label: string;
  type: string;
  options?: string[];
}): boolean {
  if (col.type !== "DROPDOWN" && col.type !== "YES_NO") return false;
  const opts = (col.options ?? []).map((o) => String(o).trim().toUpperCase());
  return opts.includes("AM") && opts.includes("PM");
}

/** Half-day period to pre-fill rows: before midday UK → AM, otherwise PM. */
export function getDefaultAmPmForLondon(now: Date = new Date()): "AM" | "PM" {
  return getLondonHour(now) < 12 ? "AM" : "PM";
}

function columnIsAmPmPeriod(col: Parameters<typeof isTableColumnAmPmPeriod>[0]): boolean {
  return isTableColumnAmPmPeriod(col);
}

type GridField = {
  key: string;
  label: string;
  type: string;
  columns?: Array<{ key: string; label: string; type: string; options?: string[] }>;
};

export type TimingBlockingIssue = {
  fieldKey: string;
  rowIndex: number;
  pathLabel: string;
  message: string;
};

/**
 * Blocks save when today's date (UK) is paired with AM/PM that contradicts current UK clock
 * (e.g. AM selected after 3pm, or PM before 8am).
 */
export function getTimingBlockingIssuesStructured(
  fields: GridField[],
  values: Record<string, unknown>,
  now: Date = new Date()
): TimingBlockingIssue[] {
  const issues: TimingBlockingIssue[] = [];
  const todayYmd = getLondonYmd(now);
  const hour = getLondonHour(now);

  for (const f of fields) {
    if (f.type !== "TABLE_GRID" || !f.columns?.length) continue;
    const periodCol = f.columns.find(columnIsAmPmPeriod);
    const dateCol = f.columns.find((c) => c.type === "DATE");
    if (!periodCol || !dateCol) continue;

    const rows = (values[f.key] as Record<string, unknown>[]) ?? [];
    rows.forEach((row, idx) => {
      const dateRaw = String(row[dateCol.key] ?? "").trim();
      if (!dateRaw) return;
      const iso = normalizeDateInputForStorage(dateRaw) || dateRaw;
      const rowYmd = iso.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rowYmd) || rowYmd !== todayYmd) return;

      const period = String(row[periodCol.key] ?? "").trim().toUpperCase();
      if (period === "AM") {
        if (hour >= 15) {
          issues.push({
            fieldKey: f.key,
            rowIndex: idx,
            pathLabel: `${f.label} — row ${idx + 1}`,
            message:
              "The reading date is today (UK) with period AM, but the current UK time is after 3:00 pm. This row should usually be PM, or the date should be the day the morning reading was taken. The form cannot be saved until this is corrected.",
          });
        }
      } else if (period === "PM") {
        if (hour < 8) {
          issues.push({
            fieldKey: f.key,
            rowIndex: idx,
            pathLabel: `${f.label} — row ${idx + 1}`,
            message:
              "The reading date is today (UK) with period PM, but the current UK time is before 8:00 am. This row should usually be AM, or the date should be corrected. The form cannot be saved until this is fixed.",
          });
        }
      }
    });
  }

  return issues;
}

export function getTimingBlockingIssues(
  fields: GridField[],
  values: Record<string, unknown>,
  now: Date = new Date()
): string[] {
  return getTimingBlockingIssuesStructured(fields, values, now).map((i) => `${i.pathLabel}: ${i.message}`);
}
