import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseStaffAssistantRequestBody, staffAssistantResponseSchema } from "@/lib/staff-assistant-schema";
import { mergeStaffAssistantFieldGlossaries, resolveStaffAssistantFlow } from "@/lib/staff-assistant-flows";
import { buildStaffAssistantSystemPrompt } from "@/lib/staff-assistant-prompt";
import { staffAssistantRateLimitTake } from "@/lib/staff-assistant-rate-limit";
import { redactStaffAssistantShareText } from "@/lib/staff-assistant-redact";

export const runtime = "nodejs";

function parseAiJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseStaffAssistantRequestBody(json);
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
      console.warn("staff-assistant: OPENAI_API_KEY missing");
    }
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const flow = resolveStaffAssistantFlow(body.pathname);
  const mergedFields = mergeStaffAssistantFieldGlossaries(flow.defaultFields, body.pageContext?.fields);

  const shared =
    body.sharedFormSummary && body.sharedFormSummary.trim()
      ? redactStaffAssistantShareText(body.sharedFormSummary.trim())
      : undefined;

  const system = buildStaffAssistantSystemPrompt({
    flow,
    mergedFields,
    mode: body.mode,
    draftFieldLabel: body.draftFieldLabel,
  });

  const msgs = body.messages;
  if (msgs.length === 0 || msgs[msgs.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });
  }

  const last = msgs[msgs.length - 1];
  const lastContent =
    last.content.slice(0, 12000) +
    (shared
      ? `\n\n---\nUser-approved optional context (may be edited; treat as confidential):\n${shared}\n---`
      : "");

  const tail =
    body.mode === "draft_field"
      ? ([
          {
            role: "user" as const,
            content:
              `${lastContent}\n\n(Field id: ${body.draftFieldId ?? "unknown"}. Reply as JSON with message, suggestedNextStep, draftSuggestion.)`.slice(
                0,
                12000
              ),
          },
        ] as const)
      : ([{ role: "user" as const, content: lastContent }] as const);

  const openaiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...(body.mode === "draft_field"
      ? []
      : msgs.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))),
    ...tail,
  ];

  if (process.env.NODE_ENV !== "production") {
    console.info("staff-assistant request", {
      userId: session.user.id,
      pathname: body.pathname.slice(0, 200),
      mode: body.mode,
      messageCount: body.messages.length,
      hasSharedSummary: Boolean(shared),
    });
  }

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
        temperature: body.mode === "draft_field" ? 0.35 : 0.25,
        response_format: { type: "json_object" },
        messages: openaiMessages,
      }),
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("staff-assistant fetch", e);
    } else {
      console.error("staff-assistant fetch failed");
    }
    return NextResponse.json({ error: "Could not reach AI service" }, { status: 502 });
  }

  if (!upstream.ok) {
    const t = await upstream.text().catch(() => "");
    console.error("staff-assistant upstream", upstream.status, t.slice(0, 200));
    return NextResponse.json({ error: "AI service error" }, { status: 502 });
  }

  const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
  }

  const obj = parseAiJson(raw);
  const result = staffAssistantResponseSchema.safeParse(obj);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid AI response shape" }, { status: 502 });
  }

  const out = result.data;
  if (!out.message.trim()) {
    out.message = "Here is a quick tip: use the links in this panel to jump to Staff, Roster, or Audits. Ask a specific question when you are ready.";
  }

  return NextResponse.json(out);
}
