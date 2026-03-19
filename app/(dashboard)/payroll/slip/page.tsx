import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPayrollForWeek, getPayrollForPeriod } from "../actions";
import { SalarySlip } from "@/components/payroll/SalarySlip";
import { SlipFullView } from "@/components/payroll/SlipFullView";

export default async function PayrollSlipPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; weekStart?: string; weekEnd?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const params = await searchParams;
  const userId = params.userId;
  const weekStartParam = params.weekStart;
  const weekEndParam = params.weekEnd;

  if (!userId || !weekStartParam) {
    return (
      <div className="p-8 text-center text-[var(--muted-foreground)]">
        Missing userId or weekStart. Open from Payroll page.
      </div>
    );
  }

  const weekStart = new Date(weekStartParam);
  const payroll =
    weekEndParam && !isNaN(new Date(weekEndParam).getTime())
      ? await getPayrollForPeriod(weekStart, new Date(weekEndParam))
      : await getPayrollForWeek(weekStart);
  const worker = payroll.workers.find((w) => w.userId === userId);

  if (!worker) {
    return (
      <div className="p-8 text-center text-[var(--muted-foreground)]">
        Worker not found or no hours for this week.
      </div>
    );
  }

  const daysForSlip = worker.days.map((d) => ({
    date: d.date,
    dateLabel: d.dateLabel,
    clockInAt: d.clockInAt instanceof Date ? d.clockInAt.toISOString() : new Date(d.clockInAt).toISOString(),
    clockOutAt: d.clockOutAt ? (d.clockOutAt instanceof Date ? d.clockOutAt.toISOString() : new Date(d.clockOutAt).toISOString()) : null,
    breakMinutes: d.breakMinutes,
    totalMinutes: d.totalMinutes,
    totalHours: d.totalHours,
    shiftType: d.shiftType,
    propertyName: d.propertyName ?? null,
  }));

  return (
    <SlipFullView>
      <SalarySlip
        workerName={worker.name}
        workerEmail={worker.email}
        weekLabel={payroll.weekLabel}
        days={daysForSlip}
        totalHours={worker.totalHours}
        hourlyRate={worker.hourlyRate}
        totalPay={worker.totalPay}
        propertyBreakdown={worker.propertyBreakdown ?? []}
      />
    </SlipFullView>
  );
}
