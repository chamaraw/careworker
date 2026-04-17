"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getServiceUsers() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const list = await prisma.serviceUser.findMany({
    orderBy: { name: "asc" },
  });
  return list;
}

export async function getProperties() {
  const session = await auth();
  if (!session?.user?.id) return [];
  if (!prisma?.property) return [];
  return prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Active care packages for service user create/edit (admin). */
export async function getCarePackagesForSelect() {
  const session = await auth();
  if (!session?.user?.id) return [];
  if ((session.user as { role?: string }).role !== "ADMIN") return [];
  return prisma.carePackage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

async function assertCarePackageIdOrThrow(carePackageId: string | null) {
  if (!carePackageId) return;
  const p = await prisma.carePackage.findFirst({
    where: { id: carePackageId, isActive: true },
    select: { id: true },
  });
  if (!p) throw new Error("Care package not found or inactive.");
}

export async function getServiceUserDetail(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.serviceUser.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, label: true } },
      carePackage: {
        select: {
          id: true,
          name: true,
          slug: true,
          templates: {
            include: {
              formTemplate: {
                select: { id: true, name: true, isActive: true, assignmentScope: true, category: true },
              },
            },
          },
        },
      },
      carePlans: { orderBy: { createdAt: "desc" }, take: 5 },
      incidentReports: { orderBy: { occurredAt: "desc" }, take: 5, include: { careWorker: { select: { name: true } } } },
      shifts: { orderBy: { startAt: "desc" }, take: 5, include: { careWorker: { select: { name: true } } } },
    },
  });
  return user;
}

export async function createServiceUser(data: {
  name: string;
  dateOfBirth?: Date;
  address?: string;
  propertyId?: string | null;
  unitId?: string | null;
  allergies?: string;
  medicalNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  careNeedsLevel?: string;
  carePackageId?: string | null;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  if (data.unitId && data.propertyId) {
    const u = await prisma.propertyUnit.findFirst({
      where: { id: data.unitId, propertyId: data.propertyId },
    });
    if (!u) throw new Error("Unit does not belong to selected property");
  }
  const pkgId = data.carePackageId?.trim() ? data.carePackageId.trim() : null;
  await assertCarePackageIdOrThrow(pkgId);
  const row = await prisma.serviceUser.create({
    data: {
      name: data.name.trim(),
      dateOfBirth: data.dateOfBirth ?? null,
      address: data.address?.trim() ?? null,
      propertyId: data.propertyId ?? null,
      unitId: data.unitId && data.propertyId ? data.unitId : null,
      allergies: data.allergies?.trim() ?? null,
      medicalNotes: data.medicalNotes?.trim() ?? null,
      emergencyContactName: data.emergencyContactName?.trim() ?? null,
      emergencyContactPhone: data.emergencyContactPhone?.trim() ?? null,
      careNeedsLevel: data.careNeedsLevel?.trim() ?? null,
      carePackageId: pkgId,
    },
    select: { propertyId: true },
  });
  revalidatePath("/service-users");
  revalidatePath("/housing");
  if (row.propertyId) {
    revalidatePath(`/audits/property/${row.propertyId}`);
  }
  revalidatePath("/audits/manager");
  revalidatePath("/audits/recording");
}

export async function updateServiceUser(
  id: string,
  data: Partial<{
    name: string;
    dateOfBirth: Date | null;
    address: string;
    propertyId: string | null;
    unitId: string | null;
    allergies: string;
    medicalNotes: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    careNeedsLevel: string;
    carePackageId: string | null;
  }>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const existing = await prisma.serviceUser.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");

  const nextPropertyId =
    data.propertyId !== undefined ? data.propertyId : existing.propertyId;
  const nextUnitId =
    data.unitId !== undefined ? data.unitId : existing.unitId;

  if (nextUnitId && nextPropertyId) {
    const u = await prisma.propertyUnit.findFirst({
      where: { id: nextUnitId, propertyId: nextPropertyId },
    });
    if (!u) throw new Error("Unit does not belong to selected property");
  }
  if (nextUnitId && !nextPropertyId) {
    throw new Error("Select a property before assigning a unit");
  }

  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.dateOfBirth !== undefined) update.dateOfBirth = data.dateOfBirth;
  if (data.address !== undefined) update.address = data.address.trim() || null;
  if (data.propertyId !== undefined) {
    update.propertyId = data.propertyId;
    if (data.propertyId !== existing.propertyId && data.unitId === undefined) {
      update.unitId = null;
    }
  }
  if (data.unitId !== undefined) update.unitId = data.unitId;
  if (data.allergies !== undefined) update.allergies = data.allergies.trim() || null;
  if (data.medicalNotes !== undefined) update.medicalNotes = data.medicalNotes.trim() || null;
  if (data.emergencyContactName !== undefined) update.emergencyContactName = data.emergencyContactName.trim() || null;
  if (data.emergencyContactPhone !== undefined) update.emergencyContactPhone = data.emergencyContactPhone.trim() || null;
  if (data.careNeedsLevel !== undefined) update.careNeedsLevel = data.careNeedsLevel.trim() || null;
  if (data.carePackageId !== undefined) {
    const raw = data.carePackageId?.trim() ? data.carePackageId.trim() : null;
    await assertCarePackageIdOrThrow(raw);
    update.carePackageId = raw;
  }
  await prisma.serviceUser.update({ where: { id }, data: update });
  revalidatePath("/service-users");
  revalidatePath("/housing");
  const propId = nextPropertyId;
  if (propId) {
    revalidatePath(`/audits/property/${propId}`);
  }
  revalidatePath("/audits/manager");
  revalidatePath("/audits/recording");
}
