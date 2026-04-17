import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  wizardComposeResolvedResponseSchema,
  wizardComposeTextareaResponseSchema,
  wizardQuestionsResponseSchema,
  wizardRequestSchema,
  wizardTextSuggestionsResponseSchema,
} from "@/lib/staff-assistant-wizard-schema";
import {
  STAFF_ASSISTANT_WIZARD_ROLE_PREAMBLE,
  buildWizardComposeUserPayload,
  buildWizardQuestionsUserPayload,
  buildWizardResolveFieldUserPayload,
  buildWizardTextSuggestionsUserPayload,
} from "@/lib/staff-assistant-wizard-prompt";
import { staffAssistantRateLimitTake } from "@/lib/staff-assistant-rate-limit";
import {
  getCachedTextSuggestions,
  getCachedWizardQuestions,
  setCachedTextSuggestions,
  setCachedWizardQuestions,
} from "@/lib/staff-assistant-wizard-question-cache";
import {
  normalizeWizardComposeTextareaRaw,
  normalizeWizardQuestionsAiRaw,
  validateQuestionsCountLoose,
} from "@/lib/staff-assistant-wizard-ai-normalize";

export const runtime = "nodejs";

function parseAiJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function callOpenAiJson(args: { system: string; user: string; temperature: number }): Promise<unknown | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: args.temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });
  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    console.error("staff-assistant-wizard upstream", upstream.status, t.slice(0, 200));
    return null;
  }
  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") return null;
  return parseAiJson(raw);
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || (role !== "ADMIN" && role !== "CARE_WORKER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = wizardRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  if (!staffAssistantRateLimitTake(session.user.id)) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("staff-assistant-wizard: OPENAI_API_KEY missing");
    }
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const systemBase = `${STAFF_ASSISTANT_WIZARD_ROLE_PREAMBLE}\n\nAlways respond with a single JSON object only (no markdown).`;

  if (body.mode === "questions") {
    const fieldType = body.field.type;
    const cached = getCachedWizardQuestions(body.templateId, body.field.key, fieldType);
    if (cached) {
      return NextResponse.json(cached);
    }
    const dropdownOptions = body.field.type === "DROPDOWN" ? body.field.options : undefined;
    const numberHints =
      body.field.type === "NUMBER"
        ? { normalMin: body.field.normalMin, normalMax: body.field.normalMax, unit: body.field.unit }
        : undefined;
    const user = buildWizardQuestionsUserPayload({
      templateId: body.templateId,
      fieldKey: body.field.key,
      fieldLabel: body.field.label,
      fieldType,
      templateName: body.templateName,
      serviceUserContext: body.serviceUserContext,
      dropdownOptions,
      numberHints,
    });
    const obj = await callOpenAiJson({
      system: `${systemBase}\nYou output JSON: { "stepIntro"?: string, "questions": [ ... ] } as specified.`,
      user,
      temperature: 0.35,
    });
    if (obj == null) {
      return NextResponse.json(
        { error: "AI did not return usable data. Check OPENAI_API_KEY, model name, and network." },
        { status: 502 }
      );
    }
    const coerced = normalizeWizardQuestionsAiRaw(fieldType, obj);
    const out = wizardQuestionsResponseSchema.safeParse(coerced);
    if (!out.success) {
      if (process.env.NODE_ENV !== "production") {
        console.error("staff-assistant-wizard questions zod", out.error.flatten());
      }
      return NextResponse.json({ error: "Could not build questions" }, { status: 502 });
    }
    if (!validateQuestionsCountLoose(fieldType, out.data.questions.length)) {
      return NextResponse.json({ error: "Could not build questions" }, { status: 502 });
    }
    setCachedWizardQuestions(body.templateId, body.field.key, fieldType, out.data);
    return NextResponse.json(out.data);
  }

  if (body.mode === "compose") {
    if (body.field.type === "TEXTAREA") {
      const user = buildWizardComposeUserPayload({
        templateId: body.templateId,
        fieldKey: body.field.key,
        fieldLabel: body.field.label,
        answersJson: JSON.stringify(body.answers),
        extraNote: body.extraNote,
      });
      const obj = await callOpenAiJson({
        system: `${systemBase}\nYou output JSON: { "draft": "...", "alternatives"?: ["...", "..."] } as specified.`,
        user,
        temperature: 0.25,
      });
      if (obj == null) {
        return NextResponse.json(
          { error: "AI did not return usable data. Check OPENAI_API_KEY, model name, and network." },
          { status: 502 }
        );
      }
      const coerced = normalizeWizardComposeTextareaRaw(obj);
      const out = wizardComposeTextareaResponseSchema.safeParse(coerced);
      if (!out.success) {
        if (process.env.NODE_ENV !== "production") {
          console.error("staff-assistant-wizard compose textarea zod", out.error.flatten());
        }
        return NextResponse.json({ error: "Could not compose text" }, { status: 502 });
      }
      return NextResponse.json(out.data);
    }

    const dropdownOptions = body.field.type === "DROPDOWN" ? body.field.options : undefined;
    const numberHints =
      body.field.type === "NUMBER"
        ? { normalMin: body.field.normalMin, normalMax: body.field.normalMax, unit: body.field.unit }
        : undefined;
    const user = buildWizardResolveFieldUserPayload({
      templateId: body.templateId,
      fieldKey: body.field.key,
      fieldLabel: body.field.label,
      fieldType: body.field.type,
      answersJson: JSON.stringify(body.answers),
      extraNote: body.extraNote,
      dropdownOptions,
      numberHints,
    });
    const obj = await callOpenAiJson({
      system: `${systemBase}\nYou output JSON: { "resolvedValue": "..." } only.`,
      user,
      temperature: 0.15,
    });
    if (obj == null) {
      return NextResponse.json(
        { error: "AI did not return usable data. Check OPENAI_API_KEY, model name, and network." },
        { status: 502 }
      );
    }
    const out = wizardComposeResolvedResponseSchema.safeParse(obj);
    if (!out.success || !out.data.resolvedValue.trim()) {
      if (process.env.NODE_ENV !== "production" && !out.success) {
        console.error("staff-assistant-wizard compose resolve zod", out.error.flatten());
      }
      return NextResponse.json({ error: "Could not resolve value" }, { status: 502 });
    }
    let resolved = out.data.resolvedValue.trim();
    if (body.field.type === "YES_NO") {
      const t = resolved.toLowerCase();
      if (t === "yes" || t === "y") resolved = "Yes";
      else if (t === "no" || t === "n") resolved = "No";
      else if (resolved !== "Yes" && resolved !== "No") {
        return NextResponse.json({ error: "Invalid yes/no from model" }, { status: 502 });
      }
    }
    if (body.field.type === "DROPDOWN") {
      const exact = body.field.options.find((o) => o === resolved);
      if (exact) {
        resolved = exact;
      } else {
        const loose = body.field.options.find((o) => o.trim().toLowerCase() === resolved.toLowerCase());
        if (!loose) {
          return NextResponse.json({ error: "Resolved value not in dropdown options" }, { status: 502 });
        }
        resolved = loose;
      }
    }
    return NextResponse.json({ resolvedValue: resolved });
  }

  if (body.mode === "text_suggestions") {
    const cached = getCachedTextSuggestions(body.templateId, body.field.key);
    if (cached) {
      return NextResponse.json({ suggestions: cached });
    }
    const user = buildWizardTextSuggestionsUserPayload({
      templateId: body.templateId,
      fieldKey: body.field.key,
      fieldLabel: body.field.label,
      templateName: body.templateName,
    });
    const obj = await callOpenAiJson({
      system: `${systemBase}\nYou output JSON: { "suggestions": [ "...", ... ] } as specified.`,
      user,
      temperature: 0.35,
    });
    if (obj == null) {
      return NextResponse.json(
        { error: "AI did not return usable data. Check OPENAI_API_KEY, model name, and network." },
        { status: 502 }
      );
    }
    const out = wizardTextSuggestionsResponseSchema.safeParse(obj);
    if (!out.success) {
      if (process.env.NODE_ENV !== "production") {
        console.error("staff-assistant-wizard text_suggestions zod", out.error.flatten());
      }
      return NextResponse.json({ error: "Could not build suggestions" }, { status: 502 });
    }
    setCachedTextSuggestions(body.templateId, body.field.key, out.data.suggestions);
    return NextResponse.json(out.data);
  }

  return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
}
