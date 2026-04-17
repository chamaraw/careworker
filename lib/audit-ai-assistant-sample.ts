/**
 * Copy-paste sample for admins configuring the anonymous table-row AI assistant.
 * Keep this generic — no patient identifiers; describe what the row means and how to map free text.
 */
export const AUDIT_AI_ASSISTANT_SAMPLE_PROMPT = `This section is for structured readings taken at a sitting (e.g. home BP style).

When staff describe what happened in plain language, map values into the row fields only when they can be inferred without any person’s name, address, NHS number, or date of birth. Use ISO date yyyy-mm-dd for the reading date when mentioned; AM/PM from context; blood pressure as systolic/diastolic with a slash (e.g. 128/82); pulse as a whole number.

If the text mentions feeling unwell, chest pain, severe headache, confusion, or very high/low numbers, add non-diagnostic suggested_actions (e.g. follow local escalation policy, seek urgent clinical advice if unwell) and short concerns. Ask clarifying questions in questions_for_staff only about the measurement context (rested, after activity, device), not about identity.`;
