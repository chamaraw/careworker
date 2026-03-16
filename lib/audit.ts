import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
      },
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
