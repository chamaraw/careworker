"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";

export type HolidayRateBoost = {
  id: string;
  date: Date;
  name: string;
  multiplier: number;
};

function parseHolidayDate(dateStr: string) {
  // Treat the input as a local date at midnight to avoid UTC-shift issues.
  return startOfDay(new Date(`${dateStr}T00:00:00`));
}

export async function getHolidayRateBoosts(): Promise<HolidayRateBoost[]> {
  const session = await auth();
  if (!session?.user) return [];
  if ((session.user as { role?: string }).role !== "ADMIN") return [];

  return prisma.holidayRateBoost.findMany({
    orderBy: { date: "asc" },
    select: { id: true, date: true, name: true, multiplier: true },
  });
}

export async function createHolidayRateBoost(data: {
  date: string; // YYYY-MM-DD
  name: string;
  multiplier: number;
}): Promise<HolidayRateBoost> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");

  const day = parseHolidayDate(data.date);
  const name = data.name.trim();
  if (!name) throw new Error("Name is required");
  if (isNaN(data.multiplier) || data.multiplier < 0) throw new Error("Multiplier must be >= 0");

  const existing = await prisma.holidayRateBoost.findUnique({ where: { date: day } });
  if (existing) throw new Error("A holiday boost is already configured for that date");

  const created = await prisma.holidayRateBoost.create({
    data: { date: day, name, multiplier: data.multiplier },
    select: { id: true, date: true, name: true, multiplier: true },
  });

  revalidatePath("/rates");
  revalidatePath("/payroll");
  return created;
}

export async function updateHolidayRateBoost(
  id: string,
  data: { date: string; name: string; multiplier: number }
): Promise<HolidayRateBoost> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");

  const day = parseHolidayDate(data.date);
  const name = data.name.trim();
  if (!name) throw new Error("Name is required");
  if (isNaN(data.multiplier) || data.multiplier < 0) throw new Error("Multiplier must be >= 0");

  const updated = await prisma.holidayRateBoost.update({
    where: { id },
    data: { date: day, name, multiplier: data.multiplier },
    select: { id: true, date: true, name: true, multiplier: true },
  });

  revalidatePath("/rates");
  revalidatePath("/payroll");
  return updated;
}

export async function deleteHolidayRateBoost(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");

  await prisma.holidayRateBoost.delete({ where: { id } });
  revalidatePath("/rates");
  revalidatePath("/payroll");
}

