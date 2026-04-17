"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type {
  HsCheckKind,
  MaintenancePriority,
  MaintenanceTaskStatus,
  ServiceChargeFrequency,
  ServiceChargePaymentStatus,
} from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  return session;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function countsByPropertyId(
  rows: { propertyId: string; _count: { _all: number } }[]
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.propertyId] = r._count._all;
  return m;
}

export async function getHousingProperties() {
  await requireAdmin();
  const properties = await prisma.property.findMany({
    orderBy: { name: "asc" },
  });
  const ids = properties.map((p) => p.id);
  if (ids.length === 0) return [];

  const [unitRows, assetRows, maintRows, schedRows] = await Promise.all([
    prisma.propertyUnit.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.propertyAsset.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.maintenanceTask.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.serviceChargeSchedule.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const u = countsByPropertyId(unitRows);
  const a = countsByPropertyId(assetRows);
  const mt = countsByPropertyId(maintRows);
  const sc = countsByPropertyId(schedRows);

  return properties.map((p) => ({
    ...p,
    _count: {
      units: u[p.id] ?? 0,
      assets: a[p.id] ?? 0,
      maintenanceTasks: mt[p.id] ?? 0,
      serviceChargeSchedules: sc[p.id] ?? 0,
    },
  }));
}

export async function getHousingProperty(id: string) {
  await requireAdmin();
  return prisma.property.findUnique({
    where: { id },
    include: {
      units: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
      assets: { orderBy: { name: "asc" } },
      hsSchedules: {
        orderBy: { nextDueDate: "asc" },
        include: {
          inspections: {
            orderBy: { dueDate: "desc" },
            take: 12,
            include: { completedBy: { select: { name: true } } },
          },
        },
      },
      maintenanceTasks: {
        orderBy: { createdAt: "desc" },
        include: {
          unit: { select: { label: true } },
          assignee: { select: { name: true } },
        },
      },
      serviceChargeSchedules: {
        orderBy: { name: "asc" },
        include: {
          payments: {
            orderBy: { periodStart: "desc" },
            take: 50,
            include: {
              serviceUser: { select: { id: true, name: true } },
              unit: { select: { label: true } },
            },
          },
        },
      },
      serviceUsers: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          unitId: true,
          unit: { select: { label: true } },
        },
      },
    },
  });
}

export async function getPropertyUnitsForSelect(propertyId: string) {
  await requireAdmin();
  return prisma.propertyUnit.findMany({
    where: { propertyId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });
}

export async function createProperty(data: {
  name: string;
  address?: string;
  addressLine1?: string;
  city?: string;
  postcode?: string;
  communalAreasNotes?: string;
}) {
  await requireAdmin();
  await prisma.property.create({
    data: {
      name: data.name.trim(),
      address: data.address?.trim() || null,
      addressLine1: data.addressLine1?.trim() || null,
      city: data.city?.trim() || null,
      postcode: data.postcode?.trim() || null,
      communalAreasNotes: data.communalAreasNotes?.trim() || null,
    },
  });
  revalidatePath("/housing");
}

export async function updateProperty(
  id: string,
  data: Partial<{
    name: string;
    address: string | null;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
    communalAreasNotes: string | null;
  }>
) {
  await requireAdmin();
  await prisma.property.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.postcode !== undefined && { postcode: data.postcode }),
      ...(data.communalAreasNotes !== undefined && {
        communalAreasNotes: data.communalAreasNotes,
      }),
    },
  });
  revalidatePath("/housing");
  revalidatePath(`/housing/${id}`);
}

export async function createPropertyUnit(propertyId: string, label: string, floor?: string) {
  await requireAdmin();
  await prisma.propertyUnit.create({
    data: {
      propertyId,
      label: label.trim(),
      floor: floor?.trim() || null,
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function deletePropertyUnit(unitId: string, propertyId: string) {
  await requireAdmin();
  await prisma.propertyUnit.delete({ where: { id: unitId } });
  revalidatePath(`/housing/${propertyId}`);
}

export async function createPropertyAsset(
  propertyId: string,
  data: { name: string; category?: string; location?: string; notes?: string }
) {
  await requireAdmin();
  await prisma.propertyAsset.create({
    data: {
      propertyId,
      name: data.name.trim(),
      category: data.category?.trim() || null,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function deletePropertyAsset(assetId: string, propertyId: string) {
  await requireAdmin();
  await prisma.propertyAsset.delete({ where: { id: assetId } });
  revalidatePath(`/housing/${propertyId}`);
}

export async function createHsSchedule(
  propertyId: string,
  data: {
    title: string;
    checkKind: HsCheckKind;
    intervalMonths: number;
    nextDueDate: Date;
    notes?: string;
  }
) {
  await requireAdmin();
  const schedule = await prisma.hsInspectionSchedule.create({
    data: {
      propertyId,
      title: data.title.trim(),
      checkKind: data.checkKind,
      frequency: "MONTHLY",
      intervalMonths: Math.max(1, data.intervalMonths),
      nextDueDate: data.nextDueDate,
      notes: data.notes?.trim() || null,
    },
  });
  await prisma.hsInspection.create({
    data: {
      scheduleId: schedule.id,
      dueDate: data.nextDueDate,
      status: "DUE",
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function completeHsInspection(inspectionId: string, propertyId: string) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("No user id");

  const inspection = await prisma.hsInspection.findUnique({
    where: { id: inspectionId },
    include: { schedule: true },
  });
  if (!inspection || inspection.schedule.propertyId !== propertyId) {
    throw new Error("Inspection not found");
  }
  if (inspection.status === "COMPLETED") return;

  const nextDue = addMonths(
    inspection.dueDate,
    inspection.schedule.intervalMonths
  );

  await prisma.$transaction([
    prisma.hsInspection.update({
      where: { id: inspectionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: userId,
      },
    }),
    prisma.hsInspectionSchedule.update({
      where: { id: inspection.scheduleId },
      data: { nextDueDate: nextDue },
    }),
    prisma.hsInspection.create({
      data: {
        scheduleId: inspection.scheduleId,
        dueDate: nextDue,
        status: "DUE",
      },
    }),
  ]);
  revalidatePath(`/housing/${propertyId}`);
}

export async function createMaintenanceTask(
  propertyId: string,
  data: {
    title: string;
    description?: string;
    priority: MaintenancePriority;
    unitId?: string | null;
    assignedToId?: string | null;
    dueAt?: Date | null;
  }
) {
  await requireAdmin();
  await prisma.maintenanceTask.create({
    data: {
      propertyId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      priority: data.priority,
      status: "OPEN",
      unitId: data.unitId ?? null,
      assignedToId: data.assignedToId ?? null,
      dueAt: data.dueAt ?? null,
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function updateMaintenanceTask(
  taskId: string,
  propertyId: string,
  data: Partial<{
    status: MaintenanceTaskStatus;
    assignedToId: string | null;
    priority: MaintenancePriority;
  }>
) {
  await requireAdmin();
  const completedAt =
    data.status === undefined
      ? undefined
      : data.status === "DONE"
        ? new Date()
        : null;

  await prisma.maintenanceTask.update({
    where: { id: taskId },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(completedAt !== undefined && { completedAt }),
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function createServiceChargeSchedule(
  propertyId: string,
  data: {
    name: string;
    description?: string;
    amount: number;
    frequency: ServiceChargeFrequency;
    startDate: Date;
  }
) {
  await requireAdmin();
  await prisma.serviceChargeSchedule.create({
    data: {
      propertyId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      amount: data.amount,
      frequency: data.frequency,
      startDate: data.startDate,
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function createServiceChargePayment(
  propertyId: string,
  data: {
    scheduleId: string;
    serviceUserId: string;
    unitId?: string | null;
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
    amountDue: number;
  }
) {
  await requireAdmin();
  await prisma.serviceChargePayment.create({
    data: {
      scheduleId: data.scheduleId,
      serviceUserId: data.serviceUserId,
      unitId: data.unitId ?? null,
      periodLabel: data.periodLabel.trim(),
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      amountDue: data.amountDue,
      amountPaid: 0,
      status: "DUE",
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function updateServiceChargePayment(
  paymentId: string,
  propertyId: string,
  data: {
    amountPaid: number;
    status: ServiceChargePaymentStatus;
    paidAt?: Date | null;
    reference?: string | null;
  }
) {
  await requireAdmin();
  await prisma.serviceChargePayment.update({
    where: { id: paymentId },
    data: {
      amountPaid: data.amountPaid,
      status: data.status,
      paidAt: data.paidAt ?? null,
      reference: data.reference?.trim() || null,
    },
  });
  revalidatePath(`/housing/${propertyId}`);
}

export async function assignServiceUserToUnit(
  serviceUserId: string,
  propertyId: string,
  unitId: string | null
) {
  await requireAdmin();
  const su = await prisma.serviceUser.findUnique({ where: { id: serviceUserId } });
  if (!su || su.propertyId !== propertyId) {
    throw new Error("Service user must belong to this property");
  }
  if (unitId) {
    const unit = await prisma.propertyUnit.findFirst({
      where: { id: unitId, propertyId },
    });
    if (!unit) throw new Error("Invalid unit");
  }
  await prisma.serviceUser.update({
    where: { id: serviceUserId },
    data: { unitId },
  });
  revalidatePath(`/housing/${propertyId}`);
  revalidatePath("/service-users");
}

export async function getCareWorkersForAssign() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function exportServiceChargePaymentsCsv(propertyId: string) {
  await requireAdmin();
  const rows = await prisma.serviceChargePayment.findMany({
    where: { schedule: { propertyId } },
    orderBy: { periodStart: "desc" },
    include: {
      schedule: { select: { name: true } },
      serviceUser: { select: { name: true } },
      unit: { select: { label: true } },
    },
  });

  const header = [
    "periodLabel",
    "periodStart",
    "periodEnd",
    "schedule",
    "tenant",
    "unit",
    "amountDue",
    "amountPaid",
    "status",
    "paidAt",
    "reference",
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        escape(r.periodLabel),
        escape(r.periodStart.toISOString().slice(0, 10)),
        escape(r.periodEnd.toISOString().slice(0, 10)),
        escape(r.schedule.name),
        escape(r.serviceUser.name),
        escape(r.unit?.label ?? ""),
        r.amountDue,
        r.amountPaid,
        r.status,
        r.paidAt ? escape(r.paidAt.toISOString().slice(0, 10)) : "",
        escape(r.reference),
      ].join(",")
    ),
  ];
  return lines.join("\n");
}
