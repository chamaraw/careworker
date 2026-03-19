import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPayrollForWeek, getPayrollForPeriod } from "./actions";
import { getTimeRecords, getCareWorkersForHours, getPropertiesForHours } from "@/app/(dashboard)/hours/actions";
import { getWeekBounds } from "@/lib/payroll";
import { PayrollClient } from "./PayrollClient";
import { startOfWeek, startOfMonth, endOfMonth, endOfDay } from "date-fns";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  let dateFromParam = params.dateFrom ?? "";
  let dateToParam = params.dateTo ?? "";
  const weekParam = params.week;
  let useCustomPeriod: boolean;
  let periodStart: Date;
  let periodEnd: Date;

  if (dateFromParam && dateToParam) {
    useCustomPeriod = true;
    periodStart = new Date(dateFromParam);
    periodEnd = new Date(dateToParam);
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()) || periodEnd < periodStart) {
      periodStart = startOfMonth(now);
      periodEnd = endOfMonth(now);
      dateFromParam = periodStart.toISOString().slice(0, 10);
      dateToParam = periodEnd.toISOString().slice(0, 10);
    }
  } else if (weekParam) {
    useCustomPeriod = false;
    const bounds = getWeekBounds(new Date(weekParam));
    periodStart = bounds.weekStart;
    periodEnd = bounds.weekEnd;
  } else {
    useCustomPeriod = true;
    periodStart = startOfMonth(now);
    periodEnd = endOfDay(now);
    dateFromParam = periodStart.toISOString().slice(0, 10);
    dateToParam = periodEnd.toISOString().slice(0, 10);
  }

  const [payroll, timeRecords, careWorkers, properties] = await Promise.all([
    useCustomPeriod
      ? getPayrollForPeriod(periodStart, periodEnd)
      : getPayrollForWeek(periodStart),
    getTimeRecords({ dateFrom: periodStart, dateTo: periodEnd }),
    getCareWorkersForHours(),
    getPropertiesForHours(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Payroll</h1>
        <p className="body-text-muted mt-1">
          Run payroll for a week or custom period. Add hours manually if needed, approve below, then generate slips.
        </p>
      </div>
      <PayrollClient
        initialPayroll={payroll}
        timeRecords={timeRecords}
        careWorkers={careWorkers}
        properties={properties}
        weekStartStr={payroll.weekStart.toISOString().slice(0, 10)}
        weekEndStr={payroll.weekEnd.toISOString().slice(0, 10)}
        useCustomPeriod={!!useCustomPeriod}
        dateFromParam={dateFromParam ?? ""}
        dateToParam={dateToParam ?? ""}
        defaultWeekStartStr={getWeekBounds(startOfWeek(new Date(), { weekStartsOn: 1 })).weekStart.toISOString().slice(0, 10)}
      />
    </div>
  );
}
