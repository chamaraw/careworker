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

export async function getServiceUserDetail(id: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.serviceUser.findUnique({
    where: { id },
    include: {
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
  allergies?: string;
  medicalNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  careNeedsLevel?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.serviceUser.create({
    data: {
      name: data.name.trim(),
      dateOfBirth: data.dateOfBirth ?? null,
      address: data.address?.trim() ?? null,
      propertyId: data.propertyId ?? null,
      allergies: data.allergies?.trim() ?? null,
      medicalNotes: data.medicalNotes?.trim() ?? null,
      emergencyContactName: data.emergencyContactName?.trim() ?? null,
      emergencyContactPhone: data.emergencyContactPhone?.trim() ?? null,
      careNeedsLevel: data.careNeedsLevel?.trim() ?? null,
    },
  });
  revalidatePath("/service-users");
}

export async function updateServiceUser(
  id: string,
  data: Partial<{
    name: string;
    dateOfBirth: Date | null;
    address: string;
    propertyId: string | null;
    allergies: string;
    medicalNotes: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    careNeedsLevel: string;
  }>
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.dateOfBirth !== undefined) update.dateOfBirth = data.dateOfBirth;
  if (data.address !== undefined) update.address = data.address.trim() || null;
  if (data.propertyId !== undefined) update.propertyId = data.propertyId;
  if (data.allergies !== undefined) update.allergies = data.allergies.trim() || null;
  if (data.medicalNotes !== undefined) update.medicalNotes = data.medicalNotes.trim() || null;
  if (data.emergencyContactName !== undefined) update.emergencyContactName = data.emergencyContactName.trim() || null;
  if (data.emergencyContactPhone !== undefined) update.emergencyContactPhone = data.emergencyContactPhone.trim() || null;
  if (data.careNeedsLevel !== undefined) update.careNeedsLevel = data.careNeedsLevel.trim() || null;
  await prisma.serviceUser.update({ where: { id }, data: update });
  revalidatePath("/service-users");
}
