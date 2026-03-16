"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { FollowUpStatus } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";

export async function getFollowUpActions(filters: {
  serviceUserId?: string;
  status?: FollowUpStatus;
  dueFrom?: Date;
  dueTo?: Date;
}) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const actions = await prisma.followUpAction.findMany({
    where: {
      ...(filters.serviceUserId && { serviceUserId: filters.serviceUserId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.dueFrom && { dueDate: { gte: startOfDay(filters.dueFrom) } }),
      ...(filters.dueTo && { dueDate: { lte: endOfDay(filters.dueTo) } }),
    },
    include: {
      serviceUser: { select: { id: true, name: true } },
      incident: { select: { id: true, description: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 100,
  });
  return actions;
}

export async function createFollowUpAction(data: {
  serviceUserId: string;
  description: string;
  dueDate: Date;
  incidentId?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const action = await prisma.followUpAction.create({
    data: {
      serviceUserId: data.serviceUserId,
      description: data.description.trim(),
      dueDate: new Date(data.dueDate),
      incidentId: data.incidentId ?? null,
      createdById: session.user.id,
      status: "PENDING",
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "CREATE",
    entity: "FollowUpAction",
    entityId: action.id,
  });
  revalidatePath("/follow-ups");
  revalidatePath("/roster");
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
  return action;
}

export async function completeFollowUpAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await prisma.followUpAction.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: session.user.id,
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "UPDATE",
    entity: "FollowUpAction",
    entityId: id,
    details: JSON.stringify({ status: "COMPLETED" }),
  });
  revalidatePath("/follow-ups");
  revalidatePath("/roster");
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function cancelFollowUpAction(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await prisma.followUpAction.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  await logAudit({
    userId: session.user.id,
    action: "UPDATE",
    entity: "FollowUpAction",
    entityId: id,
    details: JSON.stringify({ status: "CANCELLED" }),
  });
  revalidatePath("/follow-ups");
  revalidatePath("/roster");
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}
