import Holidays from "date-holidays";
import { endOfDay, format, startOfDay } from "date-fns";

export type UkBankHoliday = {
  dateKey: string; // yyyy-MM-dd
  name: string;
};

/**
 * UK nations – union of public holidays so Scotland / NI / Wales-only days are included.
 * We only use type `public` (official bank/public holidays), not `observance` (e.g. Mother's Day).
 */
const UK_PUBLIC_HOLIDAY_REGIONS = ["GB-ENG", "GB-SCT", "GB-NIR", "GB-WLS"] as const;

/**
 * Returns all UK public/bank holidays that fall in [start, end] (inclusive by calendar date).
 */
export function getUkBankHolidaysInRange(start: Date, end: Date): UkBankHoliday[] {
  const startKey = format(startOfDay(start), "yyyy-MM-dd");
  const endKey = format(endOfDay(end), "yyyy-MM-dd");

  const startYear = startOfDay(start).getFullYear();
  const endYear = endOfDay(end).getFullYear();

  /** dateKey -> distinct holiday names (same day can appear in multiple regions with same name) */
  const byDate = new Map<string, Set<string>>();

  for (const region of UK_PUBLIC_HOLIDAY_REGIONS) {
    const holidays = new Holidays(region);
    for (let year = startYear; year <= endYear; year++) {
      for (const h of holidays.getHolidays(year)) {
        if (h.type !== "public") continue;

        const dateKey = String(h.date).slice(0, 10);
        if (dateKey < startKey || dateKey > endKey) continue;

        const name = String(h.name ?? "Bank holiday").trim();
        let set = byDate.get(dateKey);
        if (!set) {
          set = new Set<string>();
          byDate.set(dateKey, set);
        }
        set.add(name);
      }
    }
  }

  return Array.from(byDate.entries())
    .map(([dateKey, names]) => ({
      dateKey,
      name: Array.from(names).sort((a, b) => a.localeCompare(b)).join(" · "),
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function getUkBankHolidayNameMapInRange(start: Date, end: Date): Map<string, string> {
  const list = getUkBankHolidaysInRange(start, end);
  return new Map(list.map((h) => [h.dateKey, h.name]));
}
