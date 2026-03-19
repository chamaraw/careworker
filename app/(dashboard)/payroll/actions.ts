"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { format } from "date-fns";
import { getWeekBounds, type PayrollDay, type PayrollWorker } from "@/lib/payroll";
import { resolveRate, calculatePay } from "@/lib/rate-calc";

export type { PayrollDay, PayrollWorker } from "@/lib/payroll";

/** Fetch payroll for all care workers for the week containing the given day. Real-time from approved time records; uses rate cards. */
export async function getPayrollForWeek(referenceDate: Date): Promise<{
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  workers: PayrollWorker[];
}> {
  const session = await auth();
  if (!session?.user) return { weekStart: new Date(), weekEnd: new Date(), weekLabel: "", workers: [] };
  if ((session.user as { role?: string }).role !== "ADMIN")
    return { weekStart: new Date(), weekEnd: new Date(), weekLabel: "", workers: [] };

  const { weekStart, weekEnd } = getWeekBounds(referenceDate);

  const [careWorkers, timeRecords] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CARE_WORKER", active: true },
      select: {
        id: true,
        name: true,
        email: true,
        hourlyRate: true,
        rateCardId: true,
        rateOverrides: true,
        rateCard: { select: { rules: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.timeRecord.findMany({
      where: {
        clockInAt: { gte: weekStart, lte: weekEnd },
        approvalStatus: "APPROVED",
        user: { role: "CARE_WORKER" },
      },
      include: {
        user: { select: { id: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: { clockInAt: "asc" },
    }),
  ]);

  const workers: PayrollWorker[] = careWorkers.map((user) => {
    const records = timeRecords.filter((r) => r.userId === user.id);
    const days: PayrollDay[] = records.map((r) => {
      const mins = r.totalMinutes ?? 0;
      const hours = Math.round((mins / 60) * 100) / 100;
      const dateKey = format(r.clockInAt, "yyyy-MM-dd");
      return {
        date: dateKey,
        dateLabel: format(r.clockInAt, "EEE d MMM"),
        clockInAt: r.clockInAt,
        clockOutAt: r.clockOutAt,
        breakMinutes: r.breakMinutes ?? 0,
        totalMinutes: mins,
        totalHours: hours,
        shiftType: r.shiftType,
        propertyId: r.propertyId,
        propertyName: r.property?.name ?? null,
      };
    });
    days.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      const ta = a.clockInAt instanceof Date ? a.clockInAt.getTime() : new Date(a.clockInAt).getTime();
      const tb = b.clockInAt instanceof Date ? b.clockInAt.getTime() : new Date(b.clockInAt).getTime();
      return ta - tb;
    });

    let totalPay = 0;
    const propertyMap = new Map<string, { propertyId: string | null; propertyName: string | null; hours: number; pay: number }>();
    for (const r of records) {
      const hours = (r.totalMinutes ?? 0) / 60;
      const rate = resolveRate(user, r.shiftType);
      const pay = calculatePay(rate, hours);
      totalPay += pay;
      const key = r.propertyId ?? "__none__";
      const propName = r.property?.name ?? null;
      const existing = propertyMap.get(key);
      if (existing) {
        existing.hours += hours;
        existing.pay += pay;
      } else {
        propertyMap.set(key, { propertyId: r.propertyId, propertyName: propName, hours, pay });
      }
    }
    const propertyBreakdown = Array.from(propertyMap.values()).map((p) => ({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      hours: Math.round(p.hours * 100) / 100,
      pay: Math.round(p.pay * 100) / 100,
    }));

    const totalMinutes = records.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      hourlyRate: user.hourlyRate,
      days,
      totalMinutes,
      totalHours,
      totalPay: totalPay > 0 ? Math.round(totalPay * 100) / 100 : null,
      propertyBreakdown,
    };
  });

  const weekLabel = `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;
  return { weekStart, weekEnd, weekLabel, workers };
}

/** Fetch payroll for a custom date range. Same shape as getPayrollForWeek; uses rate cards. */
export async function getPayrollForPeriod(periodStart: Date, periodEnd: Date): Promise<{
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  workers: PayrollWorker[];
}> {
  const session = await auth();
  if (!session?.user) return { weekStart: new Date(), weekEnd: new Date(), weekLabel: "", workers: [] };
  if ((session.user as { role?: string }).role !== "ADMIN")
    return { weekStart: new Date(), weekEnd: new Date(), weekLabel: "", workers: [] };

  const [careWorkers, timeRecords] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CARE_WORKER", active: true },
      select: {
        id: true,
        name: true,
        email: true,
        hourlyRate: true,
        rateCardId: true,
        rateOverrides: true,
        rateCard: { select: { rules: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.timeRecord.findMany({
      where: {
        clockInAt: { gte: periodStart, lte: periodEnd },
        approvalStatus: "APPROVED",
        user: { role: "CARE_WORKER" },
      },
      include: {
        user: { select: { id: true } },
        property: { select: { id: true, name: true } },
      },
      orderBy: { clockInAt: "asc" },
    }),
  ]);

  const workers: PayrollWorker[] = careWorkers.map((user) => {
    const records = timeRecords.filter((r) => r.userId === user.id);
    const days: PayrollDay[] = records.map((r) => {
      const mins = r.totalMinutes ?? 0;
      const hours = Math.round((mins / 60) * 100) / 100;
      const dateKey = format(r.clockInAt, "yyyy-MM-dd");
      return {
        date: dateKey,
        dateLabel: format(r.clockInAt, "EEE d MMM"),
        clockInAt: r.clockInAt,
        clockOutAt: r.clockOutAt,
        breakMinutes: r.breakMinutes ?? 0,
        totalMinutes: mins,
        totalHours: hours,
        shiftType: r.shiftType,
        propertyId: r.propertyId,
        propertyName: r.property?.name ?? null,
      };
    });
    days.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      const ta = a.clockInAt instanceof Date ? a.clockInAt.getTime() : new Date(a.clockInAt).getTime();
      const tb = b.clockInAt instanceof Date ? b.clockInAt.getTime() : new Date(b.clockInAt).getTime();
      return ta - tb;
    });

    let totalPay = 0;
    const propertyMap = new Map<string, { propertyId: string | null; propertyName: string | null; hours: number; pay: number }>();
    for (const r of records) {
      const hours = (r.totalMinutes ?? 0) / 60;
      const rate = resolveRate(user, r.shiftType);
      const pay = calculatePay(rate, hours);
      totalPay += pay;
      const key = r.propertyId ?? "__none__";
      const propName = r.property?.name ?? null;
      const existing = propertyMap.get(key);
      if (existing) {
        existing.hours += hours;
        existing.pay += pay;
      } else {
        propertyMap.set(key, { propertyId: r.propertyId, propertyName: propName, hours, pay });
      }
    }
    const propertyBreakdown = Array.from(propertyMap.values()).map((p) => ({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      hours: Math.round(p.hours * 100) / 100,
      pay: Math.round(p.pay * 100) / 100,
    }));

    const totalMinutes = records.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      hourlyRate: user.hourlyRate,
      days,
      totalMinutes,
      totalHours,
      totalPay: totalPay > 0 ? Math.round(totalPay * 100) / 100 : null,
      propertyBreakdown,
    };
  });

  const weekLabel = `${format(periodStart, "d MMM")} – ${format(periodEnd, "d MMM yyyy")}`;
  return { weekStart: periodStart, weekEnd: periodEnd, weekLabel, workers };
}

export async function getCareWorkersForPayroll() {
  const session = await auth();
  if (!session?.user) return [];
  if ((session.user as { role?: string }).role !== "ADMIN") return [];
  return prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    select: { id: true, name: true, hourlyRate: true },
    orderBy: { name: "asc" },
  });
}

export async function setHourlyRate(userId: string, hourlyRate: number | null) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.user.update({
    where: { id: userId },
    data: { hourlyRate: hourlyRate ?? undefined },
  });
}

/** Current user's pay slip periods (weeks with approved time records). */
export async function getMyPaySlipPeriods(): Promise<
  { weekStart: string; weekEnd: string; weekLabel: string }[]
> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const records = await prisma.timeRecord.findMany({
    where: { userId: session.user.id, approvalStatus: "APPROVED" },
    select: { clockInAt: true },
  });
  const weekSet = new Map<number, { weekStart: Date; weekEnd: Date }>();
  for (const r of records) {
    const { weekStart, weekEnd } = getWeekBounds(r.clockInAt);
    const key = weekStart.getTime();
    if (!weekSet.has(key)) weekSet.set(key, { weekStart, weekEnd });
  }
  return Array.from(weekSet.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, { weekStart, weekEnd }]) => ({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      weekLabel: `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`,
    }));
}

/** Payroll for current user only (for My Pay slip). */
export async function getMyPayrollForWeek(referenceDate: Date): Promise<{
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  workers: PayrollWorker[];
}> {
  const session = await auth();
  if (!session?.user?.id)
    return { weekStart: new Date(), weekEnd: new Date(), weekLabel: "", workers: [] };
  const userId = session.user.id;
  const { weekStart, weekEnd } = getWeekBounds(referenceDate);

  const [user, timeRecords] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        hourlyRate: true,
        rateCardId: true,
        rateOverrides: true,
        rateCard: { select: { rules: true } },
      },
    }),
    prisma.timeRecord.findMany({
      where: {
        userId,
        clockInAt: { gte: weekStart, lte: weekEnd },
        approvalStatus: "APPROVED",
      },
      include: {
        property: { select: { id: true, name: true } },
      },
      orderBy: { clockInAt: "asc" },
    }),
  ]);

  if (!user) return { weekStart, weekEnd, weekLabel: "", workers: [] };

  const days: PayrollDay[] = timeRecords.map((r) => {
    const mins = r.totalMinutes ?? 0;
    const hours = Math.round((mins / 60) * 100) / 100;
    const dateKey = format(r.clockInAt, "yyyy-MM-dd");
    return {
      date: dateKey,
      dateLabel: format(r.clockInAt, "EEE d MMM"),
      clockInAt: r.clockInAt,
      clockOutAt: r.clockOutAt,
      breakMinutes: r.breakMinutes ?? 0,
      totalMinutes: mins,
      totalHours: hours,
      shiftType: r.shiftType,
      propertyId: r.propertyId,
      propertyName: r.property?.name ?? null,
    };
  });
  days.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const ta = a.clockInAt instanceof Date ? a.clockInAt.getTime() : new Date(a.clockInAt).getTime();
    const tb = b.clockInAt instanceof Date ? b.clockInAt.getTime() : new Date(b.clockInAt).getTime();
    return ta - tb;
  });

  let totalPay = 0;
  const propertyMap = new Map<string, { propertyId: string | null; propertyName: string | null; hours: number; pay: number }>();
  for (const r of timeRecords) {
    const hours = (r.totalMinutes ?? 0) / 60;
    const rate = resolveRate(user, r.shiftType);
    const pay = calculatePay(rate, hours);
    totalPay += pay;
    const key = r.propertyId ?? "__none__";
    const propName = r.property?.name ?? null;
    const existing = propertyMap.get(key);
    if (existing) {
      existing.hours += hours;
      existing.pay += pay;
    } else {
      propertyMap.set(key, { propertyId: r.propertyId, propertyName: propName, hours, pay });
    }
  }
  const propertyBreakdown = Array.from(propertyMap.values()).map((p) => ({
    propertyId: p.propertyId,
    propertyName: p.propertyName,
    hours: Math.round(p.hours * 100) / 100,
    pay: Math.round(p.pay * 100) / 100,
  }));

  const totalMinutes = timeRecords.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const weekLabel = `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;

  const worker: PayrollWorker = {
    userId: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    hourlyRate: user.hourlyRate,
    days,
    totalMinutes,
    totalHours,
    totalPay: totalPay > 0 ? Math.round(totalPay * 100) / 100 : null,
    propertyBreakdown,
  };

  return { weekStart, weekEnd, weekLabel, workers: [worker] };
}

/** Current user's rate package and properties they've worked at (for My Pay page). */
export async function getMyRatesAndVenues(): Promise<{
  rateCardName: string | null;
  rateCardRules: Array<{ shiftType: string; rateType: string; hourlyRate: number | null; fixedAmount: number | null; bonusHours: number }>;
  fallbackHourlyRate: number | null;
  overrides: Array<{ shiftType: string; rateType: string; hourlyRate: number | null; fixedAmount: number | null; bonusHours: number }>;
  propertiesWorked: Array<{ id: string; name: string }>;
}> {
  const session = await auth();
  if (!session?.user?.id)
    return { rateCardName: null, rateCardRules: [], fallbackHourlyRate: null, overrides: [], propertiesWorked: [] };

  const [user, propertyIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        hourlyRate: true,
        rateCard: { select: { name: true, rules: true } },
        rateOverrides: true,
      },
    }),
    prisma.timeRecord.findMany({
      where: { userId: session.user.id, approvalStatus: "APPROVED" },
      select: { propertyId: true },
      distinct: ["propertyId"],
    }),
  ]);

  if (!user)
    return { rateCardName: null, rateCardRules: [], fallbackHourlyRate: null, overrides: [], propertiesWorked: [] };

  const ids = (propertyIds.map((p) => p.propertyId).filter(Boolean) as string[]).filter(Boolean);
  const properties = ids.length
    ? await prisma.property.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return {
    rateCardName: user.rateCard?.name ?? null,
    rateCardRules: (user.rateCard?.rules ?? []).map((r) => ({
      shiftType: r.shiftType,
      rateType: r.rateType,
      hourlyRate: r.hourlyRate,
      fixedAmount: r.fixedAmount,
      bonusHours: r.bonusHours,
    })),
    fallbackHourlyRate: user.hourlyRate,
    overrides: (user.rateOverrides ?? []).map((o) => ({
      shiftType: o.shiftType,
      rateType: o.rateType,
      hourlyRate: o.hourlyRate,
      fixedAmount: o.fixedAmount,
      bonusHours: o.bonusHours,
    })),
    propertiesWorked: properties,
  };
}
