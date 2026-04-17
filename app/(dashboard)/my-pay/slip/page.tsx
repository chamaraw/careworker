import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyPayrollForWeek } from "../../payroll/actions";
import { SalarySlip } from "@/components/payroll/SalarySlip";
import { SlipFullView } from "@/components/payroll/SlipFullView";

export default async function MyPaySlipPage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string; weekEnd?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if ((session.user as { role?: string }).role === "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const weekStartParam = params.weekStart;

  if (!weekStartParam) {
    return (
      <div className="p-8 text-center text-[var(--muted-foreground)]">
        Missing week. Open a payslip from <a href="/my-pay" className="underline">My Pay</a>.
      </div>
    );
  }

  const weekStart = new Date(weekStartParam);
  if (isNaN(weekStart.getTime())) {
    return (
      <div className="p-8 text-center text-[var(--muted-foreground)]">
        Invalid week. Open a payslip from <a href="/my-pay" className="underline">My Pay</a>.
      </div>
    );
  }

  const payroll = await getMyPayrollForWeek(weekStart);
  const worker = payroll.workers[0];

  if (!worker) {
    return (
      <div className="p-8 text-center text-[var(--muted-foreground)]">
        No approved hours for this period.
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
    basePay: d.basePay,
    pay: d.pay,
    isUkBankHoliday: d.isUkBankHoliday,
    ukBankHolidayName: d.ukBankHolidayName,
    ukHolidayMultiplier: d.ukHolidayMultiplier,
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
