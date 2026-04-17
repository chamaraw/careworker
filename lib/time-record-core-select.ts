import type { Prisma } from "@prisma/client";

/**
 * Scalar fields that exist on every deployed `TimeRecord` table before optional
 * `offRosterReason` / `linkedShiftId` columns (see `prisma/schema-neon.sql`).
 * Use on `findMany` / `findFirst` / `findUnique` so Prisma does not SELECT missing columns.
 */
export const timeRecordCoreSelect = {
  id: true,
  userId: true,
  propertyId: true,
  shiftType: true,
  clockInAt: true,
  clockOutAt: true,
  breakMinutes: true,
  totalMinutes: true,
  approvalStatus: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TimeRecordSelect;

export type TimeRecordCore = Prisma.TimeRecordGetPayload<{ select: typeof timeRecordCoreSelect }>;
