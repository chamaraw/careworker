"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, endOfDay, subDays } from "date-fns";
import {
  BASELINE_MINUTES_PER_SHIFT,
  DEFAULT_BASELINE_MINUTES,
  BASELINE_COMPLETION_RATE,
  BASELINE_INCIDENTS_PER_100H,
  BASELINE_JOURNAL_PER_10H,
} from "@/lib/performance-baseline";

export type WorkerPerformanceRow = {
  workerId: string;
  workerName: string;
  propertyId: string | null;
  propertyName: string | null;
  approvedHours: number;
  shiftsScheduled: number;
  shiftsCompleted: number;
  journalEntries: number;
  incidents: number;
  /** Expected hours based on completed shifts and care need (national baseline). */
  expectedHours: number;
  /** (actual - expected) / expected * 100. Negative = under baseline time, positive = over. */
  timeVariancePct: number | null;
  /** shiftsCompleted / shiftsScheduled, or null if none scheduled. */
  completionRatePct: number | null;
  /** Incidents per 100 approved hours. */
  incidentsPer100h: number;
  /** Journal entries per 10 approved hours. */
  journalPer10h: number;
  /** Composite score vs baseline (100 = at national average, >100 better, <100 worse). */
  performanceIndex: number | null;
  /** Rank among workers in this result set (1 = best). */
  rank: number | null;
};

export async function getProperties() {
  const session = await auth();
  if (!session?.user) return [];
  if (!prisma?.property) return [];
  const list = await prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return list;
}

export async function getCareWorkers() {
  const session = await auth();
  if (!session?.user) return [];
  const list = await prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return list;
}

/** Admin only: performance stats per care worker, optionally filtered by worker and/or property (venue). */
export async function getPerformanceStats(filters: {
  workerId?: string;
  propertyId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<WorkerPerformanceRow[]> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return [];
  const from = filters.dateFrom ?? startOfDay(subDays(new Date(), 30));
  const to = filters.dateTo ?? endOfDay(new Date());

  const workers = await prisma.user.findMany({
    where: {
      role: "CARE_WORKER",
      active: true,
      ...(filters.workerId ? { id: filters.workerId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const workerIds = workers.map((w) => w.id);

  const [timeRecords, shifts, shiftsWithCareNeed, journalCounts, incidents] = await Promise.all([
    prisma.timeRecord.findMany({
      where: {
        userId: { in: workerIds },
        clockInAt: { gte: from, lte: to },
        approvalStatus: "APPROVED",
      },
      select: { userId: true, totalMinutes: true },
    }),
    prisma.shift.findMany({
      where: {
        careWorkerId: { in: workerIds },
        startAt: { lte: to },
        endAt: { gte: from },
        ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      },
      select: {
        careWorkerId: true,
        propertyId: true,
        status: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        careWorkerId: { in: workerIds },
        startAt: { lte: to },
        endAt: { gte: from },
        status: "COMPLETED",
        ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      },
      select: {
        careWorkerId: true,
        propertyId: true,
        serviceUser: { select: { careNeedsLevel: true } },
      },
    }),
    prisma.journalEntry.groupBy({
      by: ["careWorkerId"],
      where: {
        careWorkerId: { in: workerIds },
        recordedAt: { gte: from, lte: to },
        ...(filters.propertyId
          ? { shift: { propertyId: filters.propertyId } }
          : {}),
      },
      _count: { id: true },
    }),
    prisma.incidentReport.groupBy({
      by: ["careWorkerId"],
      where: {
        careWorkerId: { in: workerIds },
        occurredAt: { gte: from, lte: to },
        ...(filters.propertyId
          ? { serviceUser: { propertyId: filters.propertyId } }
          : {}),
      },
      _count: { id: true },
    }),
  ]);

  const propertyIds = Array.from(new Set(shifts.map((s) => s.propertyId).filter(Boolean))) as string[];
  const properties =
    propertyIds.length > 0 && prisma?.property
      ? await prisma.property.findMany({
          where: { id: { in: propertyIds } },
          select: { id: true, name: true },
        })
      : [];
  const propertyMap = new Map(properties.map((p) => [p.id, p.name]));

  const hoursByWorker = new Map<string, number>();
  for (const r of timeRecords) {
    const mins = r.totalMinutes ?? 0;
    hoursByWorker.set(r.userId, (hoursByWorker.get(r.userId) ?? 0) + mins);
  }

  const journalByWorker = new Map<string, number>();
  for (const j of journalCounts) {
    journalByWorker.set(j.careWorkerId, j._count.id);
  }

  const incidentsByWorker = new Map<string, number>();
  for (const i of incidents) {
    incidentsByWorker.set(i.careWorkerId, i._count.id);
  }

  const shiftsByWorkerProperty = new Map<string, { scheduled: number; completed: number }>();
  for (const s of shifts) {
    const key = `${s.careWorkerId}:${s.propertyId ?? "none"}`;
    const cur = shiftsByWorkerProperty.get(key) ?? { scheduled: 0, completed: 0 };
    cur.scheduled += 1;
    if (s.status === "COMPLETED") cur.completed += 1;
    shiftsByWorkerProperty.set(key, cur);
  }

  const expectedMinutesByKey = new Map<string, number>();
  for (const s of shiftsWithCareNeed) {
    const level = (s.serviceUser?.careNeedsLevel ?? "").toLowerCase() || "medium";
    const mins = BASELINE_MINUTES_PER_SHIFT[level] ?? DEFAULT_BASELINE_MINUTES;
    const key = `${s.careWorkerId}:${s.propertyId ?? "none"}`;
    expectedMinutesByKey.set(key, (expectedMinutesByKey.get(key) ?? 0) + mins);
  }

  function buildRow(
    workerId: string,
    workerName: string,
    propertyId: string | null,
    propertyName: string | null,
    approvedHours: number,
    shiftsScheduled: number,
    shiftsCompleted: number,
    journalEntries: number,
    incidents: number,
    key: string
  ): WorkerPerformanceRow {
    const expectedMins = expectedMinutesByKey.get(key) ?? 0;
    const expectedHours = expectedMins / 60;
    const timeVariancePct =
      expectedHours > 0 ? ((approvedHours - expectedHours) / expectedHours) * 100 : null;
    const completionRatePct =
      shiftsScheduled > 0 ? (shiftsCompleted / shiftsScheduled) * 100 : null;
    const incidentsPer100h = approvedHours > 0 ? (incidents / approvedHours) * 100 : 0;
    const journalPer10h = approvedHours > 0 ? (journalEntries / approvedHours) * 10 : 0;
    const performanceIndex =
      expectedHours > 0 || shiftsScheduled > 0
        ? Math.round(
            100 +
              ((completionRatePct ?? 0) - BASELINE_COMPLETION_RATE * 100) * 0.2 -
              (timeVariancePct ?? 0) * 0.15 -
              (incidentsPer100h - BASELINE_INCIDENTS_PER_100H) * 4 +
              (journalPer10h - BASELINE_JOURNAL_PER_10H) * 1.5
          )
        : null;
    return {
      workerId,
      workerName,
      propertyId,
      propertyName,
      approvedHours,
      shiftsScheduled,
      shiftsCompleted,
      journalEntries,
      incidents,
      expectedHours,
      timeVariancePct,
      completionRatePct,
      incidentsPer100h,
      journalPer10h,
      performanceIndex,
      rank: null,
    };
  }

  const rows: WorkerPerformanceRow[] = [];
  if (filters.propertyId) {
    for (const w of workers) {
      const key = `${w.id}:${filters.propertyId}`;
      const sp = shiftsByWorkerProperty.get(key) ?? { scheduled: 0, completed: 0 };
      rows.push(
        buildRow(
          w.id,
          w.name ?? "",
          filters.propertyId,
          propertyMap.get(filters.propertyId) ?? null,
          (hoursByWorker.get(w.id) ?? 0) / 60,
          sp.scheduled,
          sp.completed,
          journalByWorker.get(w.id) ?? 0,
          incidentsByWorker.get(w.id) ?? 0,
          key
        )
      );
    }
  } else {
    const workerPropertyPairs = new Set<string>();
    for (const s of shifts) {
      workerPropertyPairs.add(`${s.careWorkerId}:${s.propertyId ?? "__all__"}`);
    }
    for (const w of workers) {
      const propIds = Array.from(new Set(shifts.filter((s) => s.careWorkerId === w.id).map((s) => s.propertyId)));
      if (propIds.length === 0) {
        rows.push(
          buildRow(
            w.id,
            w.name ?? "",
            null,
            null,
            (hoursByWorker.get(w.id) ?? 0) / 60,
            0,
            0,
            journalByWorker.get(w.id) ?? 0,
            incidentsByWorker.get(w.id) ?? 0,
            `${w.id}:none`
          )
        );
      } else {
        for (const propId of propIds) {
          const key = `${w.id}:${propId ?? "none"}`;
          const sp = shiftsByWorkerProperty.get(key) ?? { scheduled: 0, completed: 0 };
          rows.push(
            buildRow(
              w.id,
              w.name ?? "",
              propId,
              propId ? propertyMap.get(propId) ?? null : null,
              (hoursByWorker.get(w.id) ?? 0) / 60,
              sp.scheduled,
              sp.completed,
              journalByWorker.get(w.id) ?? 0,
              incidentsByWorker.get(w.id) ?? 0,
              key
            )
          );
        }
      }
    }
  }

  const withIndex = rows.filter((r) => r.performanceIndex != null);
  withIndex.sort((a, b) => (b.performanceIndex ?? 0) - (a.performanceIndex ?? 0));
  withIndex.forEach((r, i) => {
    r.rank = i + 1;
  });
  const withRank = withIndex;
  const noIndex = rows.filter((r) => r.performanceIndex == null);
  noIndex.forEach((r) => {
    r.rank = null;
  });

  return [...withRank, ...noIndex].sort(
    (a, b) =>
      (a.rank ?? 999) - (b.rank ?? 999) ||
      a.workerName.localeCompare(b.workerName) ||
      (a.propertyName ?? "").localeCompare(b.propertyName ?? "")
  );
}
