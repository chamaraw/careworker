import type { StaffAssistantFlowDefinition } from "@/lib/staff-assistant-flows";
import type { StaffAssistantFieldGlossary } from "@/lib/staff-assistant-types";

function formatFlow(flow: StaffAssistantFlowDefinition): string {
  const steps = flow.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const links = flow.links.map((l) => `- ${l.label}: ${l.href}`).join("\n");
  return `PAGE FLOW: ${flow.title} (${flow.id})\n${flow.summary}\n\nCHECKLIST:\n${steps}\n\nDEEP LINKS:\n${links}`;
}

function formatFields(fields: StaffAssistantFieldGlossary[] | undefined): string {
  if (!fields?.length) return "";
  const lines = fields.map((f) => {
    const bits = [
      `${f.id} — ${f.label}${f.required ? " (required)" : ""}`,
      f.whatGoodLooksLike ? `  Good example: ${f.whatGoodLooksLike}` : null,
    ].filter(Boolean);
    return bits.join("\n");
  });
  return `\nFIELD GLOSSARY (schema only, no live values):\n${lines.join("\n")}`;
}

export function buildStaffAssistantSystemPrompt(args: {
  flow: StaffAssistantFlowDefinition;
  mergedFields?: StaffAssistantFieldGlossary[];
  mode: "chat" | "draft_field";
  draftFieldLabel?: string;
}): string {
  const fieldBlock = formatFields(args.mergedFields);
  const draftHint =
    args.mode === "draft_field" && args.draftFieldLabel
      ? `\nMODE: draft_field. Produce a concise suggested value for the field "${args.draftFieldLabel}" only, plus a short explanation. You MUST also return JSON with keys message, suggestedNextStep, draftSuggestion where draftSuggestion is plain text ready to paste (no markdown fences). Keep suggestions factual and non-clinical (no diagnosis).`
      : "";

  return [
    "You are a UK social care admin assistant for Filey Care managers using an internal web app.",
    "Audience: non-IT-literate admin users. Use short sentences, numbered steps where helpful, and British English.",
    "Never provide medical diagnosis or treatment advice. Defer clinical decisions to registered professionals and local policy.",
    "Never ask the user to paste passwords, bank card numbers, or full clinical records. If they try, refuse and suggest safer alternatives.",
    "You only help with navigation, field meanings, and drafting neutral admin text. You cannot click buttons, submit forms, or see the database.",
    "Prefer linking to in-app routes given in DEEP LINKS. Use markdown links like [Staff list](/staff) when helpful.",
    formatFlow(args.flow),
    fieldBlock,
    draftHint,
    "Respond as JSON with keys: message (string, main reply), suggestedNextStep (optional string, one concrete next action), draftSuggestion (optional string, only in draft_field mode).",
  ].join("\n\n");
}
