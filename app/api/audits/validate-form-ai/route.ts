import { auth } from "@/lib/auth";
import {
  buildFormAiValidationSystemPrompt,
  sanitizeFormAiValidationResult,
  type FormAiValidationResult,
} from "@/lib/audit-form-ai-validate";
import {
  buildFieldsSchemaForAi,
  redactPayloadForAi,
  type AiFieldSchema,
} from "@/lib/audit-form-sanitize-for-ai";
import { getLondonHour, getLondonYmd, getTimingBlockingIssues } from "@/lib/audit-form-timing-validation";
import { stripAuditSubmissionMeta } from "@/lib/audit-form-server-validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  fieldsSchema?: unknown[];
  /** Full payload for timing re-check (same as client form state + meta keys ok). */
  payload?: Record<string, unknown>;
  adminAiPrompt?: string | null;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "AI validation is not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fieldsRaw = Array.isArray(body.fieldsSchema) ? body.fieldsSchema : [];
  const fieldsSchema = buildFieldsSchemaForAi(fieldsRaw);
  if (fieldsSchema.length === 0) {
    return NextResponse.json({ error: "Missing fields schema" }, { status: 400 });
  }

  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};
  const values = stripAuditSubmissionMeta(payload);

  const gridFields = fieldsSchema.filter((f) => f.type === "TABLE_GRID");
  const timingServer = getTimingBlockingIssues(gridFields as Parameters<typeof getTimingBlockingIssues>[0], values);
  if (timingServer.length > 0) {
    return NextResponse.json(
      {
        error: "Timing check failed",
        blocking: timingServer,
      },
      { status: 400 }
    );
  }

  const adminAiPrompt =
    body.adminAiPrompt === null || body.adminAiPrompt === undefined
      ? null
      : typeof body.adminAiPrompt === "string"
        ? body.adminAiPrompt.trim() || null
        : null;

  const now = new Date();
  const redacted = redactPayloadForAi(values, fieldsSchema);

  const system = buildFormAiValidationSystemPrompt({
    fieldsSchema: fieldsSchema as AiFieldSchema[],
    adminAiPrompt,
    serverNowIso: now.toISOString(),
    londonYmd: getLondonYmd(now),
    londonHour: getLondonHour(now),
    deterministicTimingNotes: [],
  });

  const userContent = `Validate this redacted form payload against the schema. Payload:\n${JSON.stringify(redacted, null, 0)}`;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const url = `${base.replace(/\/$/, "")}/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (e) {
    console.error("validate-form-ai fetch", e);
    return NextResponse.json({ error: "Could not reach AI service" }, { status: 502 });
  }

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    console.error("validate-form-ai upstream", upstream.status, t.slice(0, 400));
    return NextResponse.json({ error: "AI service error" }, { status: 502 });
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid AI JSON" }, { status: 502 });
  }

  const result = sanitizeFormAiValidationResult(parsed);
  if (!result) {
    return NextResponse.json({ error: "Could not parse validation result" }, { status: 502 });
  }
  if (!result.summary.trim()) {
    result.summary =
      "Automatic validation completed. Review the timing and limits in the next steps, then submit if everything looks correct.";
  }

  if (result.cannot_save && result.cannot_save_reasons.length === 0) {
    result.cannot_save_reasons = [
      "The assistant flagged this submission as not ready to save. Review the form or try again.",
    ];
  }

  return NextResponse.json({ result } satisfies { result: FormAiValidationResult });
}
