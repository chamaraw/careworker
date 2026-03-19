"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { ShiftStatus } from "@prisma/client";

export async function getShifts(
  start: Date,
  end: Date,
  careWorkerId?: string,
  propertyId?: string | null
) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const shifts = await prisma.shift.findMany({
    where: {
      startAt: { lte: end },
      endAt: { gte: start },
      ...(propertyId != null && propertyId !== "" ? { propertyId } : {}),
      ...(!isAdmin && careWorkerId !== session.user.id ? { careWorkerId: session.user.id } : careWorkerId ? { careWorkerId } : {}),
    },
    include: {
      careWorker: { select: { id: true, name: true } },
      serviceUser: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });
  return shifts;
}

export async function createShift(formData: {
  careWorkerId: string;
  serviceUserId: string;
  propertyId?: string | null;
  startAt: Date;
  endAt: Date;
  notes?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  let propertyId = formData.propertyId ?? null;
  if (!propertyId) {
    const su = await prisma.serviceUser.findUnique({
      where: { id: formData.serviceUserId },
      select: { propertyId: true },
    });
    propertyId = su?.propertyId ?? null;
  }
  const shift = await prisma.shift.create({
    data: {
      careWorkerId: formData.careWorkerId,
      serviceUserId: formData.serviceUserId,
      propertyId,
      startAt: new Date(formData.startAt),
      endAt: new Date(formData.endAt),
      notes: formData.notes ?? null,
      status: "SCHEDULED",
    },
  });
  await logAudit({ userId: session.user.id ?? null, action: "CREATE", entity: "Shift", entityId: shift.id, details: JSON.stringify({ careWorkerId: formData.careWorkerId, serviceUserId: formData.serviceUserId }) });
  revalidatePath("/roster");
  revalidatePath("/dashboard");
}

export async function updateShift(
  id: string,
  data: {
    startAt?: Date;
    endAt?: Date;
    status?: ShiftStatus;
    careWorkerId?: string;
    serviceUserId?: string;
    propertyId?: string | null;
    notes?: string;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new Error("Shift not found");
  if (!isAdmin && existing.careWorkerId !== session.user.id)
    throw new Error("Forbidden");
  const updateData: Record<string, unknown> = {};
  if (data.startAt != null) updateData.startAt = new Date(data.startAt);
  if (data.endAt != null) updateData.endAt = new Date(data.endAt);
  if (data.status != null) updateData.status = data.status;
  if (isAdmin && data.careWorkerId != null) updateData.careWorkerId = data.careWorkerId;
  if (isAdmin && data.serviceUserId != null) updateData.serviceUserId = data.serviceUserId;
  if (isAdmin && data.propertyId !== undefined) updateData.propertyId = data.propertyId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  await prisma.shift.update({ where: { id }, data: updateData });
  await logAudit({ userId: session.user.id ?? null, action: "UPDATE", entity: "Shift", entityId: id, details: JSON.stringify(updateData) });
  revalidatePath("/roster");
  revalidatePath("/dashboard");
}

export async function deleteShift(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.shift.delete({ where: { id } });
  await logAudit({ userId: session.user.id ?? null, action: "DELETE", entity: "Shift", entityId: id });
  revalidatePath("/roster");
  revalidatePath("/dashboard");
}

export async function getCareWorkers() {
  const list = await prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return list;
}

export async function getServiceUsers() {
  const list = await prisma.serviceUser.findMany({
    select: { id: true, name: true, propertyId: true },
    orderBy: { name: "asc" },
  });
  return list;
}

export async function getProperties() {
  if (!prisma?.property) return [];
  const list = await prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return list;
}

/** Notes and follow-ups for a service user – show before/during shift (continue support). */
export async function getShiftContextNotes(serviceUserId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [serviceUser, journalEntries, followUpActions] = await Promise.all([
    prisma.serviceUser.findUnique({
      where: { id: serviceUserId },
      select: { name: true, medicalNotes: true, allergies: true },
    }),
    prisma.journalEntry.findMany({
      where: { shift: { serviceUserId } },
      include: {
        shift: {
          select: {
            startAt: true,
            careWorker: { select: { name: true } },
          },
        },
      },
      orderBy: { recordedAt: "desc" },
      take: 20,
    }),
    prisma.followUpAction.findMany({
      where: { serviceUserId, status: "PENDING" },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);
  return {
    serviceUser,
    journalEntries,
    followUpActions,
  };
}
