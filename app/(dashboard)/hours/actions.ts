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

export async function clockIn() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const existing = await getActiveTimeRecord(session.user.id);
  if (existing) throw new Error("Already clocked in");
  const record = await prisma.timeRecord.create({
    data: {
      userId: session.user.id,
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
