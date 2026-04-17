import { startOfWeek, endOfWeek } from "date-fns";
import {
  getActiveTimeRecord,
  getTimeRecords,
  getHoursSummary,
  getClockInEligibilityForWorker,
} from "@/app/(dashboard)/hours/actions";
import { ClockInSection } from "@/components/hours/ClockInSection";
import { TimesheetTable } from "@/components/hours/TimesheetTable";
import { Card, CardContent } from "@/components/ui/card";
import type { WorkerAuditReminderItem } from "@/lib/audit-reminders";

export async function WorkerHoursSection({
  userId,
  auditReminders,
}: {
  userId: string;
  auditReminders: WorkerAuditReminderItem[];
}) {
  const dateFrom = startOfWeek(new Date());
  const dateTo = endOfWeek(new Date());

  const [activeRecord, records, summary, clockEligibility] = await Promise.all([
    getActiveTimeRecord(userId),
    getTimeRecords({ userId, dateFrom, dateTo }),
    getHoursSummary(undefined, dateFrom, dateTo),
    getClockInEligibilityForWorker(),
  ]);

  const totalHours = (summary.totalMinutes / 60).toFixed(1);

  return (
    <div id="worker-hours" className="space-y-10 scroll-mt-6">
      <section className="space-y-3">
        <h2 className="section-title">Current shift</h2>
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="body-text-muted mb-5 leading-relaxed">
              {activeRecord
                ? `You clocked in at ${activeRecord.clockInAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
                : "Clock in at the venue on your roster for the visit you are starting (AM and PM can be different properties). Use “Different venue” with a clear reason if you are elsewhere, e.g. hospital."}
            </p>
            {auditReminders.length > 0 ? (
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Forms due today are listed under <span className="font-medium text-foreground">Audits to complete today</span>{" "}
                further down this page (after your time records for this week).
              </p>
            ) : null}
            <ClockInSection
              isClockedIn={!!activeRecord}
              clockEligibility={clockEligibility}
              auditReminders={auditReminders}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Approved hours this week</h2>
        <p className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">{totalHours} hours</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Time records</h2>
        <Card>
          <CardContent className="pt-6 pb-6">
            <TimesheetTable records={records} isAdmin={false} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
