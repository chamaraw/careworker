import type { AiFieldSchema } from "./audit-form-sanitize-for-ai";

export type FormAiValidationResult = {
  /** Short overview for staff */
  summary: string;
  /** AM/PM vs server time, date consistency */
  timing_review: string;
  /** Values vs typical / expected ranges where applicable */
  limits_review: string;
  /** Bullet list as strings */
  suggested_actions: string[];
  /** Optional extra checks */
  field_notes: string[];
  /** If true, staff must fix the form — show cannot_save_reasons */
  cannot_save: boolean;
  cannot_save_reasons: string[];
};

const JSON_SHAPE = `Respond with ONE JSON object only:
{
  "summary": "2-4 sentences, no names or identifiers",
  "timing_review": "Comment on AM/PM vs supplied server context and row dates; say if anything looks inconsistent",
  "limits_review": "Comment on numbers/options vs normal expectations for this schema (indicative only)",
  "suggested_actions": ["policy-style actions if follow-up might be needed"],
  "field_notes": ["optional short notes on specific fields by label"],
  "cannot_save": false,
  "cannot_save_reasons": []
}

Set cannot_save to true ONLY if the entered data is internally contradictory or impossible in a way that means the row should not be filed as-is (e.g. mutually exclusive answers, nonsense dates). Do NOT set cannot_save for clinical risk alone — use suggested_actions instead. Never request or output patient identifiers.`;

export function buildFormAiValidationSystemPrompt(params: {
  fieldsSchema: AiFieldSchema[];
  adminAiPrompt: string | null;
  serverNowIso: string;
  londonYmd: string;
  londonHour: number;
  deterministicTimingNotes: string[];
}): string {
  const schema = JSON.stringify(params.fieldsSchema, null, 0);
  const timing =
    params.deterministicTimingNotes.length > 0
      ? `Deterministic timing checks already flagged:\n${params.deterministicTimingNotes.map((s) => `- ${s}`).join("\n")}`
      : "No deterministic timing blocks were raised.";

  const admin = params.adminAiPrompt?.trim()
    ? `Template-specific instructions (no patient data):\n${params.adminAiPrompt.trim()}`
    : "No template-specific AI instructions.";

  return `You validate a completed audit / recording form (UK social care). Staff have already entered data; they are NOT chatting with you.

You receive:
- A JSON schema of fields (keys, labels, types, options, table columns).
- A redacted payload (some identity fields may show "[redacted]").
- Server reference time: ISO ${params.serverNowIso}, UK date ${params.londonYmd}, UK local hour ${params.londonHour} (0-23).

${timing}

${admin}

Field schema:
${schema}

${JSON_SHAPE}`;
}

export function sanitizeFormAiValidationResult(parsed: unknown): FormAiValidationResult | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;

  const str = (k: string, fallback: string) =>
    typeof o[k] === "string" && o[k].trim() ? (o[k] as string).trim() : fallback;

  const arr = (k: string): string[] => {
    if (!Array.isArray(o[k])) return [];
    return (o[k] as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim());
  };

  const cannot_save = o.cannot_save === true;
  const cannot_save_reasons = arr("cannot_save_reasons");

  return {
    summary: str("summary", ""),
    timing_review: str("timing_review", ""),
    limits_review: str("limits_review", ""),
    suggested_actions: arr("suggested_actions"),
    field_notes: arr("field_notes"),
    cannot_save,
    cannot_save_reasons: cannot_save ? cannot_save_reasons : [],
  };
}
