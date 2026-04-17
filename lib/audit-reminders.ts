import { getLondonYmd, isTableColumnAmPmPeriod } from "@/lib/audit-form-timing-validation";

export function fieldsJsonHasAmPmTableGrid(fieldsJson: unknown): boolean {
  if (!Array.isArray(fieldsJson)) return false;
  for (const f of fieldsJson) {
    if (!f || typeof f !== "object") continue;
    const row = f as { type?: string; columns?: unknown[] };
    if (row.type !== "TABLE_GRID" || !Array.isArray(row.columns)) continue;
    for (const c of row.columns) {
      if (!c || typeof c !== "object") continue;
      const col = c as { key?: string; label?: string; type?: string; options?: string[] };
      if (
        isTableColumnAmPmPeriod({
          key: String(col.key ?? ""),
          label: String(col.label ?? ""),
          type: String(col.type ?? ""),
          options: col.options,
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Templates that typically need morning + evening entries the same day (e.g. BP diary). */
export function auditTemplateLooksTwiceDaily(templateName: string, fieldsJson: unknown): boolean {
  const n = templateName.toLowerCase();
  if (
    /blood\s*pressure|\bbp\b|twice\s*daily|am\s*\/\s*pm|morning\s+and\s+evening|home\s+bp/i.test(n)
  ) {
    return true;
  }
  return fieldsJsonHasAmPmTableGrid(fieldsJson);
}

export function countSubmissionsTodayLondon(
  rows: { createdAt: Date; serviceUserId: string | null; formTemplateId: string }[],
  serviceUserId: string,
  formTemplateId: string,
  anchor: Date = new Date()
): number {
  const ymd = getLondonYmd(anchor);
  return rows.filter(
    (r) =>
      r.serviceUserId === serviceUserId &&
      r.formTemplateId === formTemplateId &&
      getLondonYmd(r.createdAt) === ymd
  ).length;
}

export type WorkerAuditReminderItem = {
  id: string;
  templateId: string;
  templateName: string;
  propertyId: string;
  propertyName: string;
  serviceUserId: string;
  serviceUserName: string;
  shiftWindowLabel: string;
  message: string;
  neededToday: number;
  haveToday: number;
  openPath: string;
};
