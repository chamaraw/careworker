"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { ShiftType, RateType } from "@prisma/client";

export async function getStaff() {
  const session = await auth();
  if (!session?.user) return [];
  if ((session.user as { role?: string }).role !== "ADMIN")
    return [];
  const list = await prisma.user.findMany({
    where: { role: "CARE_WORKER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      qualifications: true,
      active: true,
      createdAt: true,
      _count: { select: { shiftsAsWorker: true } },
    },
  });
  return list;
}

export async function createStaff(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  qualifications?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const existing = await prisma.user.findUnique({
    where: { email: data.email.trim() },
  });
  if (existing) throw new Error("Email already in use");
  const passwordHash = bcrypt.hashSync(data.password, 10);
  await prisma.user.create({
    data: {
      email: data.email.trim(),
      passwordHash,
      name: data.name.trim(),
      phone: data.phone?.trim() ?? null,
      qualifications: data.qualifications?.trim() ?? null,
      role: "CARE_WORKER",
      active: true,
    },
  });
  revalidatePath("/staff");
}

type RateOverrideInput = {
  shiftType: ShiftType;
  rateType: RateType;
  hourlyRate: number | null;
  fixedAmount: number | null;
  bonusHours: number;
};

export async function updateStaff(
  id: string,
  data: Partial<{
    name: string;
    phone: string;
    qualifications: string;
    active: boolean;
    hourlyRate: number | null;
    rateCardId: string | null;
    rateOverrides: RateOverrideInput[];
  }>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.phone !== undefined) update.phone = data.phone.trim() || null;
  if (data.qualifications !== undefined) update.qualifications = data.qualifications.trim() || null;
  if (data.active !== undefined) update.active = data.active;
  if (data.hourlyRate !== undefined) update.hourlyRate = data.hourlyRate;
  if (data.rateCardId !== undefined) update.rateCardId = data.rateCardId;

  if (data.rateOverrides !== undefined) {
    await prisma.$transaction([
      prisma.userRateOverride.deleteMany({ where: { userId: id } }),
      ...(data.rateOverrides.length > 0
        ? [
            prisma.userRateOverride.createMany({
              data: data.rateOverrides.map((o) => ({
                userId: id,
                shiftType: o.shiftType,
                rateType: o.rateType,
                hourlyRate: o.hourlyRate,
                fixedAmount: o.fixedAmount,
                bonusHours: o.bonusHours ?? 0,
              })),
            }),
          ]
        : []),
    ]);
  }

  await prisma.user.update({ where: { id }, data: update });
  revalidatePath("/staff");
  revalidatePath("/payroll");
}
