"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { Prisma, ShiftStatus } from "@prisma/client";
import { getEffectiveAuditTemplatesForRecording } from "@/lib/audit-effective-templates";
import { auditTemplateLooksTwiceDaily, countSubmissionsTodayLondon } from "@/lib/audit-reminders";

/** Multi-select roster filters (AND between dimensions). Empty arrays = no filter on that axis. */
export type RosterCalendarFilters = {
  propertyIds?: string[];
  careWorkerIds?: string[];
  serviceUserIds?: string[];
};

export async function getShifts(start: Date, end: Date, filters?: RosterCalendarFilters) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  const propertyIds = (filters?.propertyIds ?? []).filter(Boolean);
  const careWorkerIds = isAdmin ? (filters?.careWorkerIds ?? []).filter(Boolean) : [];
  const serviceUserIds = (filters?.serviceUserIds ?? []).filter(Boolean);

  const where: Prisma.ShiftWhereInput = {
    startAt: { lte: end },
    endAt: { gte: start },
  };

  if (!isAdmin) {
    where.careWorkerId = session.user.id;
  } else if (careWorkerIds.length > 0) {
    where.careWorkerId = { in: careWorkerIds };
  }

  if (serviceUserIds.length > 0) {
    where.serviceUserId = { in: serviceUserIds };
  }

  if (propertyIds.length > 0) {
    where.OR = [
      { propertyId: { in: propertyIds } },
      { propertyId: null, serviceUser: { propertyId: { in: propertyIds } } },
    ];
  }

  const shifts = await prisma.shift.findMany({
    where,
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
    notes?: string | null;
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
      select: { id: true, name: true, medicalNotes: true, allergies: true, propertyId: true },
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

  let auditsDueToday:
    | {
        templateId: string;
        templateName: string;
        neededToday: number;
        haveToday: number;
        openPath: string;
      }[]
    | null = null;

  if (serviceUser?.propertyId) {
    const [effective, recentSubs] = await Promise.all([
      getEffectiveAuditTemplatesForRecording(serviceUser.propertyId, serviceUserId, { includeFields: true }),
      prisma.auditFormSubmission.findMany({
        where: {
          serviceUserId,
          propertyId: serviceUser.propertyId,
          status: "SUBMITTED",
          createdAt: { gte: new Date(Date.now() - 40 * 60 * 60 * 1000) },
        },
        select: { serviceUserId: true, formTemplateId: true, createdAt: true },
      }),
    ]);

    const now = new Date();
    auditsDueToday = effective
      .map((t) => {
        const twice = auditTemplateLooksTwiceDaily(t.name, t.fields ?? []);
        const needed = twice ? 2 : 1;
        const have = countSubmissionsTodayLondon(recentSubs, serviceUserId, t.id, now);
        return {
          templateId: t.id,
          templateName: t.name,
          neededToday: needed,
          haveToday: have,
          openPath: `/audits/submit/${t.id}?propertyId=${encodeURIComponent(
            serviceUser.propertyId!
          )}&serviceUserId=${encodeURIComponent(serviceUserId)}`,
        };
      })
      .filter((x) => x.haveToday < x.neededToday)
      .sort((a, b) => a.templateName.localeCompare(b.templateName));
  }
  return {
    serviceUser,
    journalEntries,
    followUpActions,
    auditsDueToday,
  };
}
