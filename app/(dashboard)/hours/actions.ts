"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { TimeRecordApproval } from "@prisma/client";
import { differenceInMinutes } from "date-fns";

export async function getActiveTimeRecord(userId: string) {
  return prisma.timeRecord.findFirst({
    where: { userId, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
}

export async function clockIn(propertyId: string, shiftType: import("@prisma/client").ShiftType = "STANDARD") {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!propertyId) throw new Error("Property is required to clock in");
  const existing = await getActiveTimeRecord(session.user.id);
  if (existing) throw new Error("Already clocked in");
  const record = await prisma.timeRecord.create({
    data: {
      userId: session.user.id,
      propertyId,
      shiftType,
      clockInAt: new Date(),
    },
  });
  await logAudit({ userId: session.user.id, action: "CREATE", entity: "TimeRecord", entityId: record.id, details: "clockIn" });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
}

export async function clockOut(notes?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const record = await getActiveTimeRecord(session.user.id);
  if (!record) throw new Error("Not clocked in");
  const clockOutAt = new Date();
  const totalMinutes = differenceInMinutes(clockOutAt, record.clockInAt) - (record.breakMinutes ?? 0);
  await prisma.timeRecord.update({
    where: { id: record.id },
    data: {
      clockOutAt,
      totalMinutes: Math.max(0, totalMinutes),
      notes: notes ?? record.notes,
    },
  });
  await logAudit({ userId: session.user.id, action: "UPDATE", entity: "TimeRecord", entityId: record.id, details: "clockOut" });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
}

export async function addBreak(minutes: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const record = await getActiveTimeRecord(session.user.id);
  if (!record) throw new Error("Not clocked in");
  await prisma.timeRecord.update({
    where: { id: record.id },
    data: { breakMinutes: (record.breakMinutes ?? 0) + minutes },
  });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
}

/** Admin only: get property from a shift for the given worker on the given date (for auto-fill in Add Hours). */
export async function getShiftPropertyForWorkerDate(
  userId: string,
  dateStr: string
): Promise<{ propertyId: string | null; propertyName: string | null }> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return { propertyId: null, propertyName: null };
  const date = new Date(dateStr);
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const shift = await prisma.shift.findFirst({
    where: {
      careWorkerId: userId,
      startAt: { lt: dayEnd },
      endAt: { gt: dayStart },
      propertyId: { not: null },
    },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { startAt: "asc" },
  });
  if (!shift?.property) return { propertyId: null, propertyName: null };
  return { propertyId: shift.property.id, propertyName: shift.property.name };
}

/** Admin only: create a time record manually for a worker. Starts as PENDING so it can be approved. */
export async function createTimeRecordManual(data: {
  userId: string;
  clockInAt: Date;
  clockOutAt: Date;
  breakMinutes?: number;
  notes?: string;
  propertyId: string;
  shiftType?: import("@prisma/client").ShiftType;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  if (!data.propertyId) throw new Error("Property is required");
  const breakMinutes = data.breakMinutes ?? 0;
  const totalMinutes = Math.max(
    0,
    differenceInMinutes(data.clockOutAt, data.clockInAt) - breakMinutes
  );
  const record = await prisma.timeRecord.create({
    data: {
      userId: data.userId,
      propertyId: data.propertyId,
      clockInAt: data.clockInAt,
      clockOutAt: data.clockOutAt,
      breakMinutes,
      totalMinutes,
      notes: data.notes ?? null,
      approvalStatus: "PENDING",
      shiftType: data.shiftType ?? "STANDARD",
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entity: "TimeRecord",
    entityId: record.id,
    details: "manual entry",
  });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
}

/** Admin only: list care workers for dropdowns (e.g. add hours). */
export async function getCareWorkersForHours(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return [];
  const users = await prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return users;
}

/** Admin only: list properties for Add Hours dropdown. */
export async function getPropertiesForHours(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return [];
  return prisma.property.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** List properties for clock-in (any authenticated user). */
export async function getPropertiesForClockIn(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.property.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getTimeRecords(filters: {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const records = await prisma.timeRecord.findMany({
    where: {
      ...(filters.userId ? { userId: filters.userId } : !isAdmin ? { userId: session.user.id } : {}),
      ...((filters.dateFrom || filters.dateTo) && {
        clockInAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { clockInAt: "desc" },
    take: 100,
  });
  return records;
}

export async function setApproval(id: string, status: TimeRecordApproval) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.timeRecord.update({
    where: { id },
    data: { approvalStatus: status },
  });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
}

/** Admin only: approve all PENDING time records in the given week range. */
export async function approveAllForWeek(weekStart: Date, weekEnd: Date) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.timeRecord.updateMany({
    where: {
      clockInAt: { gte: weekStart, lte: weekEnd },
      approvalStatus: "PENDING",
    },
    data: { approvalStatus: "APPROVED" },
  });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
}

export async function updateTimeRecord(
  id: string,
  data: { clockInAt?: Date; clockOutAt?: Date; breakMinutes?: number; notes?: string }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const record = await prisma.timeRecord.findUnique({
    where: { id },
  });
  if (!record || record.userId !== session.user.id)
    throw new Error("You can only edit your own time records");
  const clockInAt = data.clockInAt ?? record.clockInAt;
  const clockOutAt = data.clockOutAt !== undefined ? data.clockOutAt : record.clockOutAt;
  const breakMinutes = data.breakMinutes ?? record.breakMinutes ?? 0;
  const totalMinutes =
    clockOutAt != null
      ? Math.max(0, differenceInMinutes(clockOutAt, clockInAt) - breakMinutes)
      : null;
  await prisma.timeRecord.update({
    where: { id },
    data: {
      ...(data.clockInAt !== undefined && { clockInAt }),
      ...(data.clockOutAt !== undefined && { clockOutAt }),
      ...(data.breakMinutes !== undefined && { breakMinutes }),
      ...(data.notes !== undefined && { notes: data.notes }),
      totalMinutes,
      approvalStatus: "PENDING",
    },
  });
  await logAudit({ userId: session.user.id, action: "UPDATE", entity: "TimeRecord", entityId: id, details: "edit" });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
}

export async function deleteTimeRecord(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const record = await prisma.timeRecord.findUnique({
    where: { id },
  });
  if (!record || record.userId !== session.user.id)
    throw new Error("You can only delete your own time records");
  await prisma.timeRecord.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "DELETE", entity: "TimeRecord", entityId: id });
  revalidatePath("/hours");
  revalidatePath("/dashboard");
}

export async function getHoursSummary(userId: string | undefined, from: Date, to: Date) {
  const session = await auth();
  if (!session?.user?.id) return { totalMinutes: 0, records: [] };
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const records = await prisma.timeRecord.findMany({
    where: {
      clockInAt: { gte: from, lte: to },
      approvalStatus: "APPROVED",
      ...(isAdmin ? (userId ? { userId } : {}) : { userId: session.user.id }),
    },
    select: { clockInAt: true, totalMinutes: true },
  });
  const totalMinutes = records.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);
  return { totalMinutes, records };
}
