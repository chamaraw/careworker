"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  entity?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}) {
  const session = await auth();
  if (!session?.user) return [];
  if ((session.user as { role?: string }).role !== "ADMIN")
    return [];
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.action && { action: filters.action }),
      ...(filters.entity && { entity: filters.entity }),
      ...((filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: filters.dateFrom }),
          ...(filters.dateTo && { lte: filters.dateTo }),
        },
      }),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 100,
  });
  return logs;
}
