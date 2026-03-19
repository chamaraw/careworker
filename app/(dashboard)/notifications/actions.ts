"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

/** Notifications for the current user (newest first). */
export async function getMyNotifications(): Promise<NotificationItem[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const list = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, message: true, link: true, read: true, createdAt: true },
  });
  return list;
}

/** Unread count for the current user. */
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  return prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });
}

/** Mark a notification as read (and optionally navigate – caller handles navigation). */
export async function markNotificationRead(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

/** Admin: send notifications to workers. workerIds = ['id1','id2'] or 'all'. */
export async function sendNotifications(params: {
  workerIds: string[] | "all";
  title: string;
  message?: string | null;
  link?: string | null;
}): Promise<{ count: number; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN")
    return { count: 0, error: "Unauthorized" };

  const ids =
    params.workerIds === "all"
      ? await prisma.user.findMany({
          where: { role: "CARE_WORKER", active: true },
          select: { id: true },
        }).then((r) => r.map((u) => u.id))
      : params.workerIds;

  if (ids.length === 0) return { count: 0, error: "No recipients" };

  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      title: params.title,
      message: params.message ?? null,
      link: params.link ?? null,
      createdById: session.user.id,
    })),
  });

  revalidatePath("/", "layout");
  return { count: ids.length };
}

/** Admin: list care workers for targeting notifications. */
export async function getWorkersForNotification(): Promise<{ id: string; name: string }[]> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN")
    return [];
  return prisma.user.findMany({
    where: { role: "CARE_WORKER", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Clear read notifications for the current user (removes them from the list). */
export async function clearReadNotifications(): Promise<{ deleted: number }> {
  const session = await auth();
  if (!session?.user?.id) return { deleted: 0 };
  const result = await prisma.notification.deleteMany({
    where: { userId: session.user.id, read: true },
  });
  revalidatePath("/", "layout");
  return { deleted: result.count };
}

/** Clear all notifications for the current user. */
export async function clearAllNotifications(): Promise<{ deleted: number }> {
  const session = await auth();
  if (!session?.user?.id) return { deleted: 0 };
  const result = await prisma.notification.deleteMany({
    where: { userId: session.user.id },
  });
  revalidatePath("/", "layout");
  return { deleted: result.count };
}
