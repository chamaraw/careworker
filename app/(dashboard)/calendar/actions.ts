"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";

export async function getCalendarNotes(from: Date, to: Date) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const notes = await prisma.calendarNote.findMany({
    where: {
      date: { gte: startOfDay(from), lte: endOfDay(to) },
    },
    include: { user: { select: { name: true } } },
    orderBy: { date: "asc" },
  });
  return notes;
}

export async function getNoteForDate(date: Date) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const start = startOfDay(date);
  const end = endOfDay(date);
  const notes = await prisma.calendarNote.findMany({
    where: { date: { gte: start, lte: end } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return notes;
}

export async function createCalendarNote(date: Date, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const dayStart = startOfDay(date);
  await prisma.calendarNote.create({
    data: {
      userId: session.user.id,
      date: dayStart,
      content: content.trim(),
    },
  });
  revalidatePath("/calendar");
}

export async function updateCalendarNote(id: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const note = await prisma.calendarNote.findUnique({ where: { id } });
  if (!note || note.userId !== session.user.id) throw new Error("Forbidden");
  await prisma.calendarNote.update({
    where: { id },
    data: { content: content.trim() },
  });
  revalidatePath("/calendar");
}

export async function deleteCalendarNote(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const note = await prisma.calendarNote.findUnique({ where: { id } });
  if (!note || note.userId !== session.user.id) throw new Error("Forbidden");
  await prisma.calendarNote.delete({ where: { id } });
  revalidatePath("/calendar");
}
