import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";
import Link from "next/link";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Calendar, AlertTriangle, Clock } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());

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
  const [myShiftsToday, recentJournal, myHoursWeek] = await Promise.all([
    prisma.shift.findMany({
      where: {
        careWorkerId: userId,
        startAt: { lte: todayEnd },
        endAt: { gte: todayStart },
        status: { not: "CANCELLED" },
      },
      include: { serviceUser: { select: { name: true } } },
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
    }),
  ]);
  const myTotalMinutes = myHoursWeek.reduce(
    (sum, r) => sum + (r.totalMinutes ?? 0),
    0
  );
  const myHoursText = (myTotalMinutes / 60).toFixed(1);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="body-text-muted mt-1">
          Welcome back, {session.user.name ?? session.user.email}.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="My shifts today"
          value={myShiftsToday.length}
          icon={Calendar}
        />
        <StatCard
          title="Hours this week"
          value={myHoursText}
          icon={Clock}
        />
      </div>
      <QuickActions />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="section-title">My shifts today</CardTitle>
          </CardHeader>
          <CardContent>
            {myShiftsToday.length === 0 ? (
              <p className="body-text-muted">No shifts today.</p>
            ) : (
              <ul className="space-y-3">
                {myShiftsToday.map((shift) => (
                  <li
                    key={shift.id}
                    className="flex justify-between items-center py-3 border-b border-[var(--border)] last:border-0"
                  >
                    <span className="font-semibold text-[var(--foreground)]">{shift.serviceUser.name}</span>
                    <span className="body-text-muted">
                      {format(shift.startAt, "HH:mm")}–{format(shift.endAt, "HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="section-title">Recent journal entries</CardTitle>
            <Link href="/journal">
              <Button variant="ghost" size="sm" className="min-h-[44px]">View all</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentJournal.length === 0 ? (
              <p className="body-text-muted">No recent entries.</p>
            ) : (
              <ul className="space-y-3">
                {recentJournal.map((entry) => (
                  <li
                    key={entry.id}
                    className="py-3 border-b border-[var(--border)] last:border-0 body-text"
                  >
                    <span className="font-semibold">{entry.shift.serviceUser.name}</span>
                    {" "}— {entry.category} — {format(entry.recordedAt, "MMM d, HH:mm")}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
