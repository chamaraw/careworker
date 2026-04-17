/**
 * Best-effort redaction before sending user-typed “share” blocks to the model.
 * Does not guarantee HIPAA/UK GDPR compliance — still minimise what is pasted.
 */
export function redactStaffAssistantShareText(input: string): string {
  let s = input;
  s = s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]");
  s = s.replace(/\b(?:\d[ -]*?){13,16}\b/g, "[number redacted]");
  s = s.replace(/password\s*[:=]\s*\S+/gi, "password: [redacted]");
  return s.slice(0, 12000);
}
