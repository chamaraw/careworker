/**
 * Strip identifiable / sensitive top-level keys before any AI call.
 * Table cell text may still contain free text — system prompt instructs the model not to echo identifiers.
 */

const REDACT_KEY = /^(service_user_name|date_of_birth|patient|nhs|national_insurance|ni_number|email|phone|address)/i;

export type AiFieldSchema = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  columns?: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
    normalMin?: number;
    normalMax?: number;
    unit?: string;
  }>;
};

export function buildFieldsSchemaForAi(fields: unknown[]): AiFieldSchema[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((f): f is Record<string, unknown> => f !== null && typeof f === "object")
    .map((f) => {
      const key = String(f.key ?? "");
      const label = String(f.label ?? "");
      const type = String(f.type ?? "TEXT");
      const base: AiFieldSchema = { key, label, type };
      if (typeof f.required === "boolean") base.required = f.required;
      if (Array.isArray(f.options)) base.options = f.options.map(String);
      if (Array.isArray(f.columns)) {
        base.columns = f.columns
          .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
          .map((c) => ({
            key: String(c.key ?? ""),
            label: String(c.label ?? ""),
            type: String(c.type ?? "TEXT"),
            ...(Array.isArray(c.options) ? { options: c.options.map(String) } : {}),
            ...(typeof c.normalMin === "number" ? { normalMin: c.normalMin } : {}),
            ...(typeof c.normalMax === "number" ? { normalMax: c.normalMax } : {}),
            ...(typeof c.unit === "string" ? { unit: c.unit } : {}),
          }));
      }
      return base;
    })
    .filter((f) => f.key.length > 0);
}

export function redactPayloadForAi(
  values: Record<string, unknown>,
  fields: AiFieldSchema[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (REDACT_KEY.test(f.key)) {
      const v = values[f.key];
      out[f.key] = v !== undefined && v !== null && String(v).trim() !== "" ? "[present — redacted]" : "";
      continue;
    }
    const v = values[f.key];
    if (f.type === "TABLE_GRID" && Array.isArray(v)) {
      out[f.key] = v.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const r = { ...(row as Record<string, unknown>) };
        for (const k of Object.keys(r)) {
          if (REDACT_KEY.test(k)) {
            const cell = r[k];
            r[k] =
              cell !== undefined && cell !== null && String(cell).trim() !== "" ? "[redacted]" : "";
          }
        }
        return r;
      });
    } else {
      out[f.key] = v;
    }
  }
  return out;
}
