"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { JournalCategory } from "@prisma/client";

export async function getJournalEntries(filters: {
  dateFrom?: Date;
  dateTo?: Date;
  careWorkerId?: string;
  serviceUserId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const entries = await prisma.journalEntry.findMany({
    where: {
      ...((filters.dateFrom || filters.dateTo) && {
        recordedAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
      ...(filters.careWorkerId ? { careWorkerId: filters.careWorkerId } : !isAdmin ? { careWorkerId: session.user.id } : {}),
      ...(filters.serviceUserId && { shift: { serviceUserId: filters.serviceUserId } }),
    },
    include: {
      shift: {
        include: { serviceUser: { select: { id: true, name: true } } },
      },
      careWorker: { select: { id: true, name: true } },
    },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });
  return entries;
}

export async function createJournalEntry(data: {
  shiftId: string;
  category: JournalCategory;
  content: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const shift = await prisma.shift.findUnique({
    where: { id: data.shiftId },
    select: { careWorkerId: true },
  });
  if (!shift || shift.careWorkerId !== session.user.id)
    throw new Error("You can only add entries to your own shifts");
  const entry = await prisma.journalEntry.create({
    data: {
      shiftId: data.shiftId,
      careWorkerId: session.user.id,
      category: data.category,
      content: data.content.trim(),
    },
  });
  await logAudit({ userId: session.user.id, action: "CREATE", entity: "JournalEntry", entityId: entry.id });
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}

/** Recent journal entries for a service user (from any shift) – for pre-roster notes. */
export async function getRecentNotesForServiceUser(
  serviceUserId: string,
  limit: number = 20
) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const entries = await prisma.journalEntry.findMany({
    where: { shift: { serviceUserId } },
    include: {
      shift: {
        select: {
          startAt: true,
          endAt: true,
          careWorker: { select: { name: true } },
        },
      },
    },
    orderBy: { recordedAt: "desc" },
    take: limit,
  });
  return entries;
}

export async function getShiftsForJournal(from: Date, to: Date) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const shifts = await prisma.shift.findMany({
    where: {
      careWorkerId: session.user.id,
      startAt: { lte: to },
      endAt: { gte: from },
      status: { not: "CANCELLED" },
    },
    include: { serviceUser: { select: { name: true } } },
    orderBy: { startAt: "desc" },
  });
  return shifts;
}

export async function updateJournalEntry(
  id: string,
  data: { category?: JournalCategory; content?: string }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: { careWorkerId: true },
  });
  if (!entry || entry.careWorkerId !== session.user.id)
    throw new Error("You can only edit your own journal entries");
  await prisma.journalEntry.update({
    where: { id },
    data: {
      ...(data.category && { category: data.category }),
      ...(data.content !== undefined && { content: data.content.trim() }),
    },
  });
  await logAudit({ userId: session.user.id, action: "UPDATE", entity: "JournalEntry", entityId: id });
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}

export async function deleteJournalEntry(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const entry = await prisma.journalEntry.findUnique({
    where: { id },
    select: { careWorkerId: true },
  });
  if (!entry || entry.careWorkerId !== session.user.id)
    throw new Error("You can only delete your own journal entries");
  await prisma.journalEntry.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "DELETE", entity: "JournalEntry", entityId: id });
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}
