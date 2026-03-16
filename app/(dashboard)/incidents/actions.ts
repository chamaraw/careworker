"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { IncidentSeverity, IncidentStatus } from "@prisma/client";

export async function getIncidents(filters: {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  serviceUserId?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const incidents = await prisma.incidentReport.findMany({
    where: {
      ...(!isAdmin && { careWorkerId: session.user.id }),
      ...(filters.status && { status: filters.status }),
      ...(filters.severity && { severity: filters.severity }),
      ...(filters.serviceUserId && { serviceUserId: filters.serviceUserId }),
    },
    include: {
      serviceUser: { select: { id: true, name: true } },
      careWorker: { select: { id: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });
  return incidents;
}

export async function createIncident(data: {
  serviceUserId: string;
  severity: IncidentSeverity;
  description: string;
  actionTaken?: string;
  followUpNotes?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const report = await prisma.incidentReport.create({
    data: {
      serviceUserId: data.serviceUserId,
      careWorkerId: session.user.id,
      severity: data.severity,
      description: data.description.trim(),
      actionTaken: data.actionTaken?.trim() || null,
      followUpNotes: data.followUpNotes?.trim() || null,
    },
  });
  await logAudit({ userId: session.user.id, action: "CREATE", entity: "IncidentReport", entityId: report.id });
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function updateIncidentStatus(id: string, status: IncidentStatus) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN")
    throw new Error("Admin only");
  await prisma.incidentReport.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/incidents");
  revalidatePath("/dashboard");
}

export async function getIncidentStats() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN") return null;
  const [open, bySeverity] = await Promise.all([
    prisma.incidentReport.count({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
    }),
    prisma.incidentReport.groupBy({
      by: ["severity"],
      where: { occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _count: true,
    }),
  ]);
  return { open, bySeverity };
}
