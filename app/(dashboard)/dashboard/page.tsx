import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WorkerHoursSection } from "@/components/dashboard/WorkerHoursSection";
import { WorkerDashboardView, type WorkerCompetencyRow } from "@/components/dashboard/WorkerDashboardView";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, AlertTriangle, Clock } from "lucide-react";
import {
  ensureMyCompetencyNotifications,
  getMyCompetencySummaryForWorker,
  getWorkerDashboardAuditReminders,
} from "../audits/actions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

  try {
  if (isAdmin) {
    const [staffCount, todayShifts, openIncidents, timeRecordsWeek] =
      await Promise.all([
        prisma.user.count({ where: { role: "CARE_WORKER", active: true } }),
        prisma.shift.findMany({
          where: {
            startAt: { lte: todayEnd },
            endAt: { gte: todayStart },
            status: { not: "CANCELLED" },
          },
          include: {
            careWorker: { select: { name: true } },
            serviceUser: { select: { name: true } },
          },
          orderBy: { startAt: "asc" },
          take: 10,
        }),
        prisma.incidentReport.count({
          where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        }),
        prisma.timeRecord.findMany({
          where: {
            clockInAt: { gte: weekStart, lte: weekEnd },
            approvalStatus: "APPROVED",
          },
          // Only totals — avoids SELECTing newer columns before DB migration (e.g. offRosterReason).
          select: { totalMinutes: true },
        }),
      ]);
    const totalMinutes = timeRecordsWeek.reduce(
      (sum, r) => sum + (r.totalMinutes ?? 0),
      0
    );
    const hoursSummary = (totalMinutes / 60).toFixed(1);

    return (
      <div className="space-y-10">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="body-text-muted mt-1">
            Welcome back, {session.user.name ?? session.user.email}.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active staff" value={staffCount} icon={Users} />
          <StatCard
            title="Shifts today"
            value={todayShifts.length}
            icon={Calendar}
          />
          <StatCard
            title="Open incidents"
            value={openIncidents}
            icon={AlertTriangle}
          />
          <StatCard
            title="Hours this week"
            value={hoursSummary}
            subtitle="Approved"
            icon={Clock}
          />
        </div>
        <QuickActions />
        <Card>
          <CardHeader>
            <CardTitle className="section-title">Today&apos;s shifts</CardTitle>
            <CardDescription className="body-text-muted">Upcoming and in progress</CardDescription>
          </CardHeader>
          <CardContent>
            {todayShifts.length === 0 ? (
              <p className="body-text-muted">No shifts scheduled today.</p>
            ) : (
              <ul className="space-y-3">
                {todayShifts.map((shift) => (
                  <li
                    key={shift.id}
                    className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0"
                  >
                    <div>
                      <span className="font-semibold text-[var(--foreground)]">{shift.serviceUser.name}</span>
                      <span className="body-text-muted ml-2">
                        — {shift.careWorker.name}
                      </span>
                    </div>
                    <span className="body-text-muted text-base">
                      {format(shift.startAt, "HH:mm")}–{format(shift.endAt, "HH:mm")}{" "}
                      {shift.status}
                    </span>
                    <Link href={`/roster?shift=${shift.id}`}>
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px]">
                        View
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Care worker view
  const [myShiftsToday, recentJournal, myHoursWeek, auditReminders, competencySummary] = await Promise.all([
    prisma.shift.findMany({
      where: {
        careWorkerId: userId,
        startAt: { lte: todayEnd },
        endAt: { gte: todayStart },
        status: { not: "CANCELLED" },
      },
      include: {
        serviceUser: { select: { name: true, property: { select: { name: true } } } },
        property: { select: { name: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.journalEntry.findMany({
      where: { careWorkerId: userId },
      include: { shift: { include: { serviceUser: { select: { name: true } } } } },
      orderBy: { recordedAt: "desc" },
      take: 5,
    }),
    prisma.timeRecord.findMany({
      where: {
        userId,
        clockInAt: { gte: weekStart, lte: weekEnd },
      },
      select: { totalMinutes: true },
    }),
    getWorkerDashboardAuditReminders(userId),
    (async () => {
      try {
        await ensureMyCompetencyNotifications(userId);
        return await getMyCompetencySummaryForWorker(userId);
      } catch {
        return {
          expiredCount: 0,
          expiringCount: 0,
          missingCount: 0,
          items: [] as WorkerCompetencyRow[],
        };
      }
    })(),
  ]);
  const myTotalMinutes = myHoursWeek.reduce(
    (sum, r) => sum + (r.totalMinutes ?? 0),
    0
  );
  const myHoursText = (myTotalMinutes / 60).toFixed(1);

  return (
    <WorkerDashboardView
      userName={session.user.name ?? session.user.email ?? "Colleague"}
      shiftsToday={myShiftsToday.map((s) => ({
        id: s.id,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        serviceUserName: s.serviceUser.name,
        venueLabel: s.property?.name ?? s.serviceUser.property?.name ?? null,
      }))}
      recentJournal={recentJournal.map((e) => ({
        id: e.id,
        serviceUserName: e.shift.serviceUser.name,
        category: String(e.category),
        recordedAt: e.recordedAt.toISOString(),
      }))}
      hoursThisWeek={myHoursText}
      auditReminders={auditReminders}
      competencyBanner={{
        expiredCount: competencySummary.expiredCount,
        expiringCount: competencySummary.expiringCount,
        missingCount: competencySummary.missingCount,
      }}
      competencyRows={competencySummary.items}
      hoursSection={<WorkerHoursSection userId={userId} auditReminders={auditReminders} />}
    />
  );
  } catch (err) {
    console.error("Dashboard data error:", err);
    return (
      <div className="space-y-10">
        <h1 className="page-title">Dashboard</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-[var(--muted-foreground)]">
              Could not load dashboard data. If you recently updated the database schema, run the
              backfill script so all time records have a property set:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-sm">npx tsx prisma/backfill-time-record-property.ts</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
