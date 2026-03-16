"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { CarePlanStatus } from "@prisma/client";

export async function getCarePlans(serviceUserId?: string) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const plans = await prisma.carePlan.findMany({
    where: serviceUserId ? { serviceUserId } : {},
    include: { serviceUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return plans;
}

export async function getCarePlan(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.carePlan.findUnique({
    where: { id },
    include: { serviceUser: { select: { id: true, name: true } } },
  });
}

export async function createCarePlan(data: {
  serviceUserId: string;
  title: string;
  goals?: string;
  interventions?: string;
  reviewDate?: Date;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.carePlan.create({
    data: {
      serviceUserId: data.serviceUserId,
      title: data.title.trim(),
      goals: data.goals?.trim() ?? null,
      interventions: data.interventions?.trim() ?? null,
      reviewDate: data.reviewDate ?? null,
      status: "ACTIVE",
    },
  });
  revalidatePath("/care-plans");
  revalidatePath("/service-users");
}

export async function updateCarePlan(
  id: string,
  data: Partial<{
    title: string;
    goals: string;
    interventions: string;
    reviewDate: Date | null;
    status: CarePlanStatus;
  }>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title.trim();
  if (data.goals !== undefined) update.goals = data.goals.trim() || null;
  if (data.interventions !== undefined) update.interventions = data.interventions.trim() || null;
  if (data.reviewDate !== undefined) update.reviewDate = data.reviewDate;
  if (data.status !== undefined) update.status = data.status;
  await prisma.carePlan.update({ where: { id }, data: update });
  revalidatePath("/care-plans");
  revalidatePath("/service-users");
}

export async function deleteCarePlan(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.carePlan.delete({ where: { id } });
  revalidatePath("/care-plans");
  revalidatePath("/service-users");
}
