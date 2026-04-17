import {
  getDefaultAmPmForLondon,
  getLondonYmd,
  isTableColumnAmPmPeriod,
} from "@/lib/audit-form-timing-validation";

type GridColumn = {
  key: string;
  label: string;
  type: string;
  options?: string[];
};

type GridField = {
  key: string;
  type: string;
  columns?: GridColumn[];
};

/** Match template option spelling (e.g. "AM" vs "am"). */
export function pickAmPmOptionValue(col: GridColumn, prefer: "AM" | "PM"): string {
  const opts = col.options ?? [];
  const want = prefer.toUpperCase();
  const hit = opts.find((o) => String(o).trim().toUpperCase() === want);
  if (hit !== undefined) return String(hit).trim();
  return prefer;
}

/** One new table row with today (UK) and current half-day where the schema has those columns. */
export function buildSmartDefaultsTableRow(field: GridField, now: Date = new Date()): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (!field.columns?.length) return row;
  const today = getLondonYmd(now);
  const dateCol = field.columns.find((c) => c.type === "DATE");
  const periodCol = field.columns.find((c) => isTableColumnAmPmPeriod(c));
  if (dateCol) row[dateCol.key] = today;
  if (periodCol) row[periodCol.key] = pickAmPmOptionValue(periodCol, getDefaultAmPmForLondon(now));
  return row;
}

/**
 * Fresh form (no draft): pre-fill empty top-level DATE fields with today (UK);
 * add one starter row to TABLE_GRIDs that have a date column (and AM/PM when present).
 */
export function applyFreshFormSmartDefaults(
  fields: Array<{
    key: string;
    type: string;
    columns?: GridColumn[];
  }>,
  values: Record<string, unknown>,
  now: Date = new Date()
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  const today = getLondonYmd(now);

  for (const f of fields) {
    if (f.type === "DATE") {
      const cur = out[f.key];
      if (cur === undefined || cur === null || (typeof cur === "string" && cur.trim() === "")) {
        out[f.key] = today;
      }
      continue;
    }
    if (f.type === "TABLE_GRID" && f.columns) {
      const rows = out[f.key];
      if (Array.isArray(rows) && rows.length > 0) continue;
      const dateCol = f.columns.find((c) => c.type === "DATE");
      if (!dateCol) continue;
      out[f.key] = [buildSmartDefaultsTableRow(f, now)];
    }
  }
  return out;
}
