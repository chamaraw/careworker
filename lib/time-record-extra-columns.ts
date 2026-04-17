import { prisma } from "@/lib/prisma";

/** Set to `true` once we detect roster columns; never cache `false` so a later migration is picked up without redeploy. */
let hasRosterExceptionColumns: boolean | null = null;

/**
 * Whether `TimeRecord.offRosterReason` (and typically `linkedShiftId`) exists in the database.
 * After migration, the next request will detect it (we only memoize a positive result).
 */
export async function timeRecordHasRosterExceptionColumns(): Promise<boolean> {
  if (hasRosterExceptionColumns === true) return true;
  try {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name = 'TimeRecord' OR LOWER(table_name) = 'timerecord')
        AND (column_name = 'offRosterReason' OR LOWER(column_name) = 'offrosterreason')
    `;
    const n = rows[0]?.n ?? 0;
    if (n > 0) {
      hasRosterExceptionColumns = true;
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
