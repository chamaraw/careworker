import { format, isValid, parse } from "date-fns";

/** Display / input format for audit form dates (UK). */
export const UK_DATE_PLACEHOLDER = "dd/mm/yyyy";

export function formatUkDateFromIso(iso: string): string {
  const d = new Date(iso);
  return isValid(d) ? format(d, "dd/MM/yyyy") : "";
}

export function formatUkDateFromDate(d: Date | null | undefined): string {
  if (!d || !isValid(d)) return "";
  return format(d, "dd/MM/yyyy");
}

/**
 * UK-first day/month/year with small input mistakes allowed:
 * - 1–2 digit day or month (e.g. 5/3/2025, 05/3/2025)
 * - Separators / . -
 * - Leading-zero dd/MM/yyyy from date-fns parse
 * - ISO yyyy-MM-dd
 * Rejects impossible dates (no rollover).
 */
export function parseFlexibleAuditDate(raw: string): Date | null {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(compact)) {
    const d = parse(compact, "yyyy-MM-dd", new Date());
    if (!isValid(d) || format(d, "yyyy-MM-dd") !== compact) return null;
    return d;
  }

  const dmy = compact.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (!isValid(d)) return null;
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }

  const uk = parse(compact, "dd/MM/yyyy", new Date());
  if (isValid(uk) && format(uk, "dd/MM/yyyy") === compact) return uk;

  return null;
}

/** Empty is treated as valid (optional fields). */
export function isValidUkDateInput(raw: string): boolean {
  if (!raw.trim()) return true;
  return parseFlexibleAuditDate(raw) !== null;
}

/** Value for <input type="date" /> (empty if not yet a parsable date). */
export function toIsoDateInputValue(raw: string): string {
  const d = parseFlexibleAuditDate(raw);
  return d ? format(d, "yyyy-MM-dd") : "";
}

/** Returns yyyy-MM-dd for storage, or "" if invalid/empty */
export function normalizeDateInputForStorage(raw: string): string {
  const d = parseFlexibleAuditDate(raw);
  return d ? format(d, "yyyy-MM-dd") : "";
}

export function ukDateInputProps() {
  return {
    placeholder: UK_DATE_PLACEHOLDER,
    inputMode: "numeric" as const,
    className: "font-mono",
  };
}
