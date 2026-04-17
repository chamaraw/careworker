export const STAFF_ASSISTANT_WIZARD_ROLE_PREAMBLE = `You are assisting a UK supported-living support worker with NVQ Level 2/3 working at a care home property, recording care for a named service user.
Use plain British English, factual and contemporaneous; never diagnose or speculate.
You generate text ONLY from structured chip selections the user has made — do not invent observations not implied by those selections.
Never include names, addresses, NHS numbers, or full clinical narratives unless the user explicitly typed them in an optional note field.`;

export function buildWizardQuestionsUserPayload(args: {
  templateId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  templateName?: string;
  serviceUserContext?: { ageBand?: string; carePackageSlug?: string };
  dropdownOptions?: string[];
  numberHints?: { normalMin?: number; normalMax?: number; unit?: string };
}): string {
  const ctx = [
    `Template id: ${args.templateId}`,
    args.templateName ? `Form name: ${args.templateName}` : null,
    `Field: ${args.fieldLabel} (${args.fieldKey})`,
    `Field type: ${args.fieldType}`,
    args.serviceUserContext?.ageBand ? `Age band (non-identifying): ${args.serviceUserContext.ageBand}` : null,
    args.serviceUserContext?.carePackageSlug ? `Care pathway slug: ${args.serviceUserContext.carePackageSlug}` : null,
    args.dropdownOptions?.length
      ? `Allowed dropdown answers (exact strings): ${args.dropdownOptions.slice(0, 30).join(" | ")}`
      : null,
    args.numberHints?.normalMin != null && args.numberHints?.normalMax != null
      ? `Typical number range: ${args.numberHints.normalMin}–${args.numberHints.normalMax}${args.numberHints.unit ? ` ${args.numberHints.unit}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (args.fieldType === "TEXTAREA") {
    return `${ctx}\n\nReturn JSON only with keys "stepIntro" (optional, max 200 chars, one line of guidance — NOT a question) and "questions" (3 to 6 items).\nEach item is a **choice group** with: id (short snake_case), prompt, allowMultiple, options {id,label} (2 to 6 options), optional recommendedOptionId.\nCRITICAL for "prompt": it MUST be a real **question** (interrogative) ending with "?" — e.g. "At what time of day was this observed?". Never use the raw field label alone, never use section headings, never use imperative instructions like "Select…" or "Enter…" as the prompt. No diagnosis questions.\nOption "label" values must be short tap labels (not full paragraphs).`;
  }

  return `${ctx}\n\nReturn JSON only with keys "stepIntro" (optional, max 200 chars — guidance line, not a question) and "questions" (1 or 2 items only).\nEach item: id (snake_case), prompt, allowMultiple, options {id,label} (2 to 6), optional recommendedOptionId.\nCRITICAL: each "prompt" MUST be a real question ending with "?". Do not echo the field label alone; do not use statements or form boilerplate as prompts. Option labels stay short. No diagnosis.`;
}

export function buildWizardComposeUserPayload(args: {
  templateId: string;
  fieldKey: string;
  fieldLabel: string;
  answersJson: string;
  extraNote?: string;
}): string {
  return `Field: ${args.fieldLabel} (${args.fieldKey})\nTemplate: ${args.templateId}\n\nChip answers (JSON):\n${args.answersJson}\n\nOptional staff note (may be empty):\n${args.extraNote ?? ""}\n\nReturn JSON with:\n- "draft": one to three short sentences (max 600 characters), first person or neutral care-record voice, UK English, based ONLY on the chip answers and optional note.\n- "alternatives": optional array of **2 or 3** strings, each another way to say the same facts as "draft" (same length band, max 600 chars each), different wording so staff can pick a favourite. No new facts not implied by the chips.\nIf you omit "alternatives", only "draft" is required.`;
}

export function buildWizardResolveFieldUserPayload(args: {
  templateId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  answersJson: string;
  extraNote?: string;
  dropdownOptions?: string[];
  numberHints?: { normalMin?: number; normalMax?: number; unit?: string };
}): string {
  const lines = [
    `Field: ${args.fieldLabel} (${args.fieldKey})`,
    `Template: ${args.templateId}`,
    `Target field type: ${args.fieldType}`,
    args.dropdownOptions?.length
      ? `For DROPDOWN, resolvedValue MUST be exactly one of: ${args.dropdownOptions.map((o) => `"${o}"`).join(", ")}`
      : null,
    args.fieldType === "YES_NO"
      ? `For YES_NO, resolvedValue MUST be exactly "Yes" or "No" (capital Y/N).`
      : null,
    args.fieldType === "DATE"
      ? `For DATE, resolvedValue MUST be ISO date YYYY-MM-DD only.`
      : null,
    args.fieldType === "NUMBER"
      ? `For NUMBER, resolvedValue MUST be a plain decimal string the app can parse (e.g. "98.6"), no units.${args.numberHints?.unit ? ` Unit for staff context only: ${args.numberHints.unit}` : ""}`
      : null,
    args.fieldType === "TEXT"
      ? `For TEXT, resolvedValue MUST be a very short phrase (under 72 characters), suitable as a quick form answer.`
      : null,
    "",
    "Chip answers (JSON):",
    args.answersJson,
    "",
    "Optional staff note:",
    args.extraNote ?? "",
    "",
    'Return JSON only: { "resolvedValue": "..." } — no other keys.',
  ];
  return lines.filter((x) => x !== null).join("\n");
}

export function buildWizardTextSuggestionsUserPayload(args: {
  templateId: string;
  fieldKey: string;
  fieldLabel: string;
  templateName?: string;
}): string {
  return [
    `Template id: ${args.templateId}`,
    args.templateName ? `Form name: ${args.templateName}` : null,
    `Short text field: ${args.fieldLabel} (${args.fieldKey})`,
    "",
    "Return JSON only with key \"suggestions\": an array of 3 to 6 very short phrase options (each under 48 characters) a support worker might tap as a quick answer. No PII. No diagnosis.",
  ]
    .filter((x) => x !== null && x !== "")
    .join("\n");
}
