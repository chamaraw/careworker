"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ShiftType, RateType } from "@prisma/client";

export async function getRateCards() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return [];
  return prisma.rateCard.findMany({
    orderBy: { name: "asc" },
    include: {
      rules: { orderBy: { shiftType: "asc" } },
      _count: { select: { users: true } },
    },
  });
}

export async function getRateCard(id: string) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return null;
  return prisma.rateCard.findUnique({
    where: { id },
    include: { rules: { orderBy: { shiftType: "asc" } } },
  });
}

type RuleInput = {
  shiftType: ShiftType;
  rateType: RateType;
  hourlyRate: number | null;
  fixedAmount: number | null;
  bonusHours: number;
};

export async function createRateCard(data: {
  name: string;
  description?: string;
  rules: RuleInput[];
}) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const existing = await prisma.rateCard.findUnique({
    where: { name: data.name.trim() },
  });
  if (existing) throw new Error("A rate card with this name already exists");
  await prisma.rateCard.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      rules: {
        create: data.rules.map((r) => ({
          shiftType: r.shiftType,
          rateType: r.rateType,
          hourlyRate: r.hourlyRate,
          fixedAmount: r.fixedAmount,
          bonusHours: r.bonusHours ?? 0,
        })),
      },
    },
  });
  revalidatePath("/rate-cards");
  revalidatePath("/staff");
  revalidatePath("/payroll");
}

export async function updateRateCard(
  id: string,
  data: {
    name: string;
    description?: string;
    rules: RuleInput[];
  }
) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const existing = await prisma.rateCard.findUnique({ where: { id } });
  if (!existing) throw new Error("Rate card not found");
  const nameTaken = await prisma.rateCard.findFirst({
    where: { name: data.name.trim(), id: { not: id } },
  });
  if (nameTaken) throw new Error("A rate card with this name already exists");
  await prisma.$transaction([
    prisma.rateCardRule.deleteMany({ where: { rateCardId: id } }),
    prisma.rateCard.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() ?? null,
        rules: {
          create: data.rules.map((r) => ({
            shiftType: r.shiftType,
            rateType: r.rateType,
            hourlyRate: r.hourlyRate,
            fixedAmount: r.fixedAmount,
            bonusHours: r.bonusHours ?? 0,
          })),
        },
      },
    }),
  ]);
  revalidatePath("/rate-cards");
  revalidatePath("/staff");
  revalidatePath("/payroll");
}

export async function deleteRateCard(id: string) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const card = await prisma.rateCard.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!card) throw new Error("Rate card not found");
  if (card._count.users > 0)
    throw new Error(`Cannot delete: ${card._count.users} employee(s) are assigned this rate card`);
  await prisma.rateCard.delete({ where: { id } });
  revalidatePath("/rate-cards");
  revalidatePath("/staff");
  revalidatePath("/payroll");
}
