import { addDays, addMonths, startOfDay } from "date-fns";

/** When a requirement has no renewal period set, assume this cycle (UK care refresher default). */
export const DEFAULT_COMPETENCY_RENEWAL_MONTHS = 12;

/**
 * Effective renewal length for expiry calculations.
 * - Positive `renewalMonths` → use as configured.
 * - `null` / `undefined` → {@link DEFAULT_COMPETENCY_RENEWAL_MONTHS}.
 * - `0` → no automatic expiry (completion stays valid until manually changed).
 */
export function effectiveRenewalMonths(renewalMonths: number | null | undefined): number | null {
  if (renewalMonths === 0) return null;
  if (renewalMonths != null && renewalMonths > 0) return renewalMonths;
  return DEFAULT_COMPETENCY_RENEWAL_MONTHS;
}

/** Warn when training expires within this many days (still counted as VALID until expiry). */
export const COMPETENCY_EXPIRING_WITHIN_DAYS = 60;

/** In-app notification link prefix for deduplication (`${COMPETENCY_NOTIFICATION_LINK_PREFIX}${requirementId}`). */
export const COMPETENCY_NOTIFICATION_LINK_PREFIX = "/dashboard?competencyNotif=";

export type CompetencyCellStatus = "NOT_REQUIRED" | "MISSING" | "VALID" | "EXPIRING" | "EXPIRED";

export function effectiveExpiresAt(
  completedAt: Date,
  storedExpiresAt: Date | null,
  renewalMonths: number | null | undefined
): Date | null {
  if (storedExpiresAt) return storedExpiresAt;
  const months = effectiveRenewalMonths(renewalMonths);
  if (months == null) return null;
  return addMonths(completedAt, months);
}

export function computeExpiresAtForNewRecord(
  completedAt: Date,
  renewalMonths: number | null | undefined
): Date | null {
  const months = effectiveRenewalMonths(renewalMonths);
  if (months == null) return null;
  return addMonths(completedAt, months);
}

export function resolveCompetencyStatus(
  latestRecord: { completedAt: Date; expiresAt: Date | null } | null,
  renewalMonths: number | null,
  now: Date = new Date()
): {
  status: CompetencyCellStatus;
  completedAt?: Date;
  expiresAt?: Date | null;
} {
  if (!latestRecord) return { status: "MISSING" };
  const exp = effectiveExpiresAt(latestRecord.completedAt, latestRecord.expiresAt, renewalMonths);
  const today = startOfDay(now);
  if (exp === null) {
    return { status: "VALID", completedAt: latestRecord.completedAt, expiresAt: null };
  }
  const expDay = startOfDay(exp);
  if (expDay < today) {
    return { status: "EXPIRED", completedAt: latestRecord.completedAt, expiresAt: exp };
  }
  const warnThrough = addDays(today, COMPETENCY_EXPIRING_WITHIN_DAYS);
  if (exp.getTime() <= warnThrough.getTime()) {
    return { status: "EXPIRING", completedAt: latestRecord.completedAt, expiresAt: exp };
  }
  return { status: "VALID", completedAt: latestRecord.completedAt, expiresAt: exp };
}

/** Latest training record per userId:requirementId (by completedAt desc). */
export function indexLatestRecordsByUserRequirement<
  T extends { userId: string; requirementId: string; completedAt: Date; expiresAt: Date | null },
>(records: T[]): Map<string, T> {
  const sorted = [...records].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  const map = new Map<string, T>();
  for (const r of sorted) {
    const k = `${r.userId}:${r.requirementId}`;
    if (!map.has(k)) map.set(k, r);
  }
  return map;
}

/** Requirement IDs that apply to this user: all `appliesToAllStaff` plus those linked to any assigned profile. */
export function applicableRequirementIdsForUser(
  profileIds: string[],
  requirements: Array<{
    id: string;
    appliesToAllStaff: boolean;
    profileLinks: Array<{ competencyProfileId: string }>;
  }>
): Set<string> {
  const profileSet = new Set(profileIds);
  const out = new Set<string>();
  for (const req of requirements) {
    if (req.appliesToAllStaff) out.add(req.id);
    for (const link of req.profileLinks) {
      if (profileSet.has(link.competencyProfileId)) out.add(req.id);
    }
  }
  return out;
}

export function tallyOrgCompetencyGaps(
  users: Array<{ id: string; profileIds: string[] }>,
  requirements: Array<{
    id: string;
    renewalMonths: number | null;
    appliesToAllStaff: boolean;
    profileLinks: Array<{ competencyProfileId: string }>;
  }>,
  records: Array<{ userId: string; requirementId: string; completedAt: Date; expiresAt: Date | null }>,
  now: Date = new Date()
): { expired: number; expiring: number; missing: number; applicableCellCount: number } {
  const latest = indexLatestRecordsByUserRequirement(records);
  let expired = 0;
  let expiring = 0;
  let missing = 0;
  let applicableCellCount = 0;
  for (const u of users) {
    const applicable = applicableRequirementIdsForUser(u.profileIds, requirements);
    for (const req of requirements) {
      if (!applicable.has(req.id)) continue;
      applicableCellCount += 1;
      const key = `${u.id}:${req.id}`;
      const rec = latest.get(key) ?? null;
      const { status } = resolveCompetencyStatus(rec, req.renewalMonths ?? null, now);
      if (status === "EXPIRED") expired += 1;
      else if (status === "EXPIRING") expiring += 1;
      else if (status === "MISSING") missing += 1;
    }
  }
  return { expired, expiring, missing, applicableCellCount };
}
