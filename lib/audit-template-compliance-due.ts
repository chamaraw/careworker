import { endOfISOWeek, getISOWeek, getISOWeekYear } from "date-fns";
import { getLondonYmd } from "@/lib/audit-form-timing-validation";
import type { AuditScheduleFrequency } from "@prisma/client";

function londonYmdParts(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function daysInMonthUtc(y: number, m1to12: number): number {
  return new Date(Date.UTC(y, m1to12, 0)).getUTCDate();
}

/** London calendar day-of-month for `date` (1–31). */
export function getLondonDayOfMonth(date: Date): number {
  const ymd = getLondonYmd(date);
  const p = londonYmdParts(ymd);
  return p?.d ?? 1;
}

/** Last calendar day of the London month containing `date`. */
export function getLondonLastDayOfMonth(date: Date): number {
  const ymd = getLondonYmd(date);
  const p = londonYmdParts(ymd);
  if (!p) return 28;
  return daysInMonthUtc(p.y, p.m);
}

export type TemplateComplianceStatus = "OK" | "DUE_SOON" | "DUE_THIS_PERIOD" | "OVERDUE";

export type TemplateComplianceResult = {
  status: TemplateComplianceStatus;
  detail: string;
  /** Inclusive filing deadline for the current period, as YYYY-MM-DD in Europe/London. */
  periodDueDateLondon: string;
};

function quarterEndYmdLondon(year: number, month1to12: number): string {
  const q = Math.floor((month1to12 - 1) / 3);
  const endMonth = (q + 1) * 3;
  const dim = daysInMonthUtc(year, endMonth);
  return `${year}-${String(endMonth).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
}

/** Current period's inclusive due date (London calendar), except weekly uses ISO week end mapped to London day. */
export function computePeriodDueDateLondon(args: {
  frequency: AuditScheduleFrequency;
  monthlyFilingDueDay: number | null;
  now?: Date;
}): string {
  const now = args.now ?? new Date();
  const todayYmd = getLondonYmd(now);
  const todayParts = londonYmdParts(todayYmd);
  if (!todayParts) return todayYmd;
  const { y: year, m: month } = todayParts;

  switch (args.frequency) {
    case "DAILY":
      return todayYmd;
    case "WEEKLY": {
      const wEnd = endOfISOWeek(now);
      return getLondonYmd(wEnd);
    }
    case "MONTHLY": {
      const lastDay = getLondonLastDayOfMonth(now);
      const dueDay = args.monthlyFilingDueDay;
      const effectiveDueDay = Math.min(dueDay ?? lastDay, lastDay);
      const dim = daysInMonthUtc(year, month);
      const day = Math.min(effectiveDueDay, dim);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    case "QUARTERLY":
      return quarterEndYmdLondon(year, month);
    case "ANNUAL":
      return `${year}-12-31`;
    default:
      return todayYmd;
  }
}

export function computeTemplateComplianceStatus(args: {
  frequency: AuditScheduleFrequency;
  monthlyFilingDueDay: number | null;
  submissionDates: Date[];
  now?: Date;
}): TemplateComplianceResult {
  const now = args.now ?? new Date();
  const todayYmd = getLondonYmd(now);
  const todayParts = londonYmdParts(todayYmd);
  const subs = args.submissionDates.map((d) => getLondonYmd(d));
  const periodDueDateLondon = computePeriodDueDateLondon({
    frequency: args.frequency,
    monthlyFilingDueDay: args.monthlyFilingDueDay,
    now,
  });

  const hasToday = subs.includes(todayYmd);
  const monthKey = todayYmd.slice(0, 7);
  const hasThisMonth = subs.some((s) => s.startsWith(monthKey));
  const year = todayParts?.y ?? new Date().getUTCFullYear();

  const isoWeekNow = `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
  const hasThisIsoWeek = args.submissionDates.some((d) => {
    const w = `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
    return w === isoWeekNow;
  });

  const q = todayParts ? Math.floor((todayParts.m - 1) / 3) + 1 : 1;
  const hasThisQuarter = subs.some((s) => {
    const p = londonYmdParts(s);
    if (!p) return false;
    const qq = Math.floor((p.m - 1) / 3) + 1;
    return p.y === year && qq === q;
  });

  const hasThisYear = subs.some((s) => s.startsWith(String(year)));

  const dueDay = args.monthlyFilingDueDay;
  const lastDay = getLondonLastDayOfMonth(now);
  const effectiveDueDay =
    args.frequency === "MONTHLY" ? Math.min(dueDay ?? lastDay, lastDay) : (dueDay ?? 15);
  const dom = getLondonDayOfMonth(now);

  switch (args.frequency) {
    case "DAILY": {
      if (hasToday) return { status: "OK", detail: "Filed today (UK date).", periodDueDateLondon };
      if (dom >= 20) return { status: "OVERDUE", detail: "No filing recorded for today yet.", periodDueDateLondon };
      if (dom >= 12) return { status: "DUE_THIS_PERIOD", detail: "Due today — no UK-day filing yet.", periodDueDateLondon };
      return {
        status: "DUE_SOON",
        detail: "Due today — complete before end of shift if required.",
        periodDueDateLondon,
      };
    }
    case "WEEKLY": {
      if (hasThisIsoWeek) return { status: "OK", detail: "Filed this ISO week.", periodDueDateLondon };
      const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(now);
      const lateWeek = ["Thu", "Fri", "Sat", "Sun"].some((p) => weekday.startsWith(p));
      if (lateWeek) {
        return {
          status: "OVERDUE",
          detail: "No filing detected this ISO week (UK dates).",
          periodDueDateLondon,
        };
      }
      return { status: "DUE_THIS_PERIOD", detail: "Weekly filing still due this week.", periodDueDateLondon };
    }
    case "MONTHLY": {
      if (hasThisMonth) return { status: "OK", detail: "Filed this calendar month (UK).", periodDueDateLondon };
      if (dom > effectiveDueDay) {
        return {
          status: "OVERDUE",
          detail: `No UK-month filing yet (due by day ${effectiveDueDay}).`,
          periodDueDateLondon,
        };
      }
      if (dom >= effectiveDueDay - 3 && dom <= effectiveDueDay) {
        return {
          status: "DUE_THIS_PERIOD",
          detail: `Due by ${effectiveDueDay}${dueDay == null ? " (end of month)" : ""} (UK).`,
          periodDueDateLondon,
        };
      }
      return {
        status: "DUE_SOON",
        detail: `Due this calendar month by day ${effectiveDueDay} (UK).`,
        periodDueDateLondon,
      };
    }
    case "QUARTERLY": {
      if (hasThisQuarter) return { status: "OK", detail: "Filed this UK calendar quarter.", periodDueDateLondon };
      const m = todayParts?.m ?? 1;
      const quarterEndMonth = [3, 6, 9, 12].includes(m) && dom >= 22;
      if (quarterEndMonth) {
        return {
          status: "OVERDUE",
          detail: "Quarterly filing still missing for this UK quarter.",
          periodDueDateLondon,
        };
      }
      return { status: "DUE_THIS_PERIOD", detail: "Quarterly filing due this UK quarter.", periodDueDateLondon };
    }
    case "ANNUAL": {
      if (hasThisYear) return { status: "OK", detail: `Filed during ${year} (UK dates).`, periodDueDateLondon };
      if (todayParts && todayParts.m === 12 && dom >= 15) {
        return {
          status: "OVERDUE",
          detail: "Annual filing still missing for this UK year.",
          periodDueDateLondon,
        };
      }
      return {
        status: "DUE_SOON",
        detail: `Annual filing due during ${year} (UK).`,
        periodDueDateLondon,
      };
    }
    default:
      return { status: "DUE_THIS_PERIOD", detail: "Check filing frequency.", periodDueDateLondon };
  }
}
