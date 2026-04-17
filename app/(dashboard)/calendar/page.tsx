import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { getCalendarNotes } from "./actions";
import { CalendarNotesView } from "./CalendarNotesView";
import { getUkBankHolidaysInRange } from "@/lib/uk-bank-holidays";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const params = await searchParams;
  const monthParam = params.month;
  const base = monthParam ? new Date(monthParam + "-01") : new Date();
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  const notes = await getCalendarNotes(start, end);
  const ukPublicHolidays = getUkBankHolidaysInRange(start, end);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Calendar Notes</h1>
      <p className="body-text-muted">
        Add notes to any date. Visible to your team. UK public holidays (England, Scotland, Wales,
        Northern Ireland) are highlighted on the calendar.
      </p>
      <CalendarNotesView
        initialMonth={base}
        notes={notes}
        ukPublicHolidays={ukPublicHolidays}
        prevMonth={subMonths(start, 1)}
        nextMonth={addMonths(start, 1)}
      />
    </div>
  );
}
