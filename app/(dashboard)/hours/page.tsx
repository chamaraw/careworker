import { auth } from "@/lib/auth";
import { startOfWeek, endOfWeek } from "date-fns";
import {
  getActiveTimeRecord,
  getTimeRecords,
  getHoursSummary,
} from "./actions";
import { ClockButton } from "@/components/hours/ClockButton";
import { BreakButton } from "@/components/hours/BreakButton";
import { TimesheetTable } from "@/components/hours/TimesheetTable";
import { Card, CardContent } from "@/components/ui/card";

export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const params = await searchParams;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : startOfWeek(new Date());
  const dateTo = params.dateTo ? new Date(params.dateTo) : endOfWeek(new Date());
  const workerId = params.worker || undefined;

  const [activeRecord, records, summary] = await Promise.all([
    getActiveTimeRecord(session.user.id),
    getTimeRecords({
      userId: workerId,
      dateFrom,
      dateTo,
    }),
    getHoursSummary(workerId ?? undefined, dateFrom, dateTo),
  ]);

  const totalHours = (summary.totalMinutes / 60).toFixed(1);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Hours</h1>
        <p className="body-text-muted mt-1">
          Clock in or out when you start or finish your shift. {isAdmin && "You can approve timesheets below."}
        </p>
      </div>

      {!isAdmin && (
        <section className="space-y-3">
          <h2 className="section-title">Current shift</h2>
          <Card>
            <CardContent className="pt-6 pb-6">
              <p className="body-text-muted mb-5">
                {activeRecord
                  ? `You clocked in at ${activeRecord.clockInAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                  : "Tap below when you start your shift."}
              </p>
              <div className="flex flex-col gap-4">
                <ClockButton isClockedIn={!!activeRecord} />
                {activeRecord && <BreakButton />}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Approved hours this week</h2>
        <p className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">{totalHours} hours</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Time records</h2>
        <Card>
          <CardContent className="pt-6 pb-6">
            <TimesheetTable records={records} isAdmin={isAdmin} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
