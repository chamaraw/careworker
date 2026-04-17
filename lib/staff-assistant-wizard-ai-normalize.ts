/**
 * Coerce OpenAI JSON into shapes our Zod schemas accept, so minor model drift
 * (extra keys, long strings, 1–2 questions for a textarea) does not always 502.
 */

export function normalizeWizardQuestionsAiRaw(fieldType: string, raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const questionsIn = Array.isArray(r.questions) ? r.questions : [];
  const questionsOut: unknown[] = [];

  for (let qi = 0; qi < questionsIn.length; qi++) {
    const item = questionsIn[qi];
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const id = String(q.id ?? `q_${qi}`).replace(/\s+/g, "_").slice(0, 80);
    const prompt = String(q.prompt ?? "").trim().slice(0, 500);
    if (!prompt) continue;
    const allowMultiple = Boolean(q.allowMultiple);
    const optsIn = Array.isArray(q.options) ? q.options : [];
    const options: { id: string; label: string }[] = [];
    for (let i = 0; i < optsIn.length; i++) {
      const o = optsIn[i];
      if (!o || typeof o !== "object") continue;
      const oo = o as Record<string, unknown>;
      const oid = String(oo.id ?? `opt_${qi}_${i}`).slice(0, 80);
      const olab = String(oo.label ?? "").trim().slice(0, 300);
      if (!olab) continue;
      options.push({ id: oid, label: olab });
    }
    if (options.length < 2) continue;
    while (options.length > 6) options.pop();

    const outQ: Record<string, unknown> = { id, prompt, allowMultiple, options };
    if (q.recommendedOptionId != null) {
      const rid = String(q.recommendedOptionId).slice(0, 80);
      if (options.some((o) => o.id === rid)) outQ.recommendedOptionId = rid;
    }
    questionsOut.push(outQ);
  }

  let questions = questionsOut;
  if (fieldType === "TEXTAREA") {
    if (questions.length > 6) questions = questions.slice(0, 6);
  } else {
    if (questions.length > 2) questions = questions.slice(0, 2);
  }

  const stepIntroRaw = r.stepIntro;
  const stepIntro =
    stepIntroRaw != null && String(stepIntroRaw).trim() !== ""
      ? String(stepIntroRaw).trim().slice(0, 280)
      : undefined;

  return {
    ...(stepIntro ? { stepIntro } : {}),
    questions,
  };
}

export function validateQuestionsCountLoose(fieldType: string, count: number): boolean {
  if (fieldType === "TEXTAREA") return count >= 1 && count <= 6;
  return count >= 1 && count <= 2;
}

export function normalizeWizardComposeTextareaRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  let draft = "";
  if (typeof r.draft === "string") draft = r.draft.trim();
  else if (typeof r.text === "string") draft = r.text.trim();
  else if (typeof r.content === "string") draft = r.content.trim();
  if (!draft) return raw;

  const maxDraft = 1200;
  draft = draft.slice(0, maxDraft);

  let alternatives: string[] | undefined;
  if (Array.isArray(r.alternatives)) {
    const alts = r.alternatives
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string") {
          return String((x as { text: string }).text).trim();
        }
        return "";
      })
      .filter(Boolean)
      .map((s) => s.slice(0, maxDraft))
      .filter((s) => s !== draft);

    const seen = new Set<string>([draft]);
    const deduped: string[] = [];
    for (const s of alts) {
      if (seen.has(s)) continue;
      seen.add(s);
      deduped.push(s);
      if (deduped.length >= 3) break;
    }
    alternatives = deduped.length ? deduped : undefined;
  }

  return { draft, ...(alternatives?.length ? { alternatives } : {}) };
}
