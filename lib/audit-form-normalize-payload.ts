import { normalizeDateInputForStorage } from "@/lib/audit-form-dates";

export type AuditFormFieldForNormalize = {
  key: string;
  type: string;
  columns?: { key: string; type: string }[];
};

/** Normalise DATE strings and grid DATE cells for storage (same rules as AuditFormRenderer). */
export function normalizeAuditFormPayloadForStorage(
  fields: AuditFormFieldForNormalize[],
  values: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const f of fields) {
    if (f.type === "DATE" && typeof out[f.key] === "string") {
      const raw = (out[f.key] as string).trim();
      if (raw) {
        const n = normalizeDateInputForStorage(raw);
        out[f.key] = n || raw;
      }
    }
    if (f.type === "TABLE_GRID" && f.columns) {
      const rows = out[f.key] as Record<string, unknown>[] | undefined;
      if (Array.isArray(rows)) {
        out[f.key] = rows.map((row) => {
          const r = { ...row };
          for (const c of f.columns!) {
            if (c.type === "DATE" && typeof r[c.key] === "string") {
              const raw = (r[c.key] as string).trim();
              if (raw) {
                const n = normalizeDateInputForStorage(raw);
                r[c.key] = n || raw;
              }
            }
          }
          return r;
        });
      }
    }
  }
  return out;
}

export function auditFormValueIsEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}
