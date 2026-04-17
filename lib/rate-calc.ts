import type { RateType, ShiftType } from "@prisma/client";

/** Resolved rate for a shift type (from override, rate card rule, or user fallback). */
export type ResolvedRate = {
  shiftType: ShiftType;
  rateType: RateType;
  hourlyRate: number | null;
  fixedAmount: number | null;
  bonusHours: number;
};

/** User with optional rate card and overrides (shape from Prisma include). */
export type UserWithRates = {
  hourlyRate: number | null;
  rateCardId: string | null;
  rateOverrides: Array<{
    shiftType: ShiftType;
    rateType: RateType;
    hourlyRate: number | null;
    fixedAmount: number | null;
    bonusHours: number;
  }>;
  rateCard?: {
    rules: Array<{
      shiftType: ShiftType;
      rateType: RateType;
      hourlyRate: number | null;
      fixedAmount: number | null;
      bonusHours: number;
    }>;
  } | null;
};

/**
 * Resolve the effective rate for a user and shift type.
 * 1. UserRateOverride for (userId, shiftType)
 * 2. RateCard rule for (rateCardId, shiftType)
 * 3. User.hourlyRate as STANDARD HOURLY fallback
 */
export function resolveRate(user: UserWithRates, shiftType: ShiftType): ResolvedRate {
  const override = user.rateOverrides?.find((o) => o.shiftType === shiftType);
  if (override) {
    return {
      shiftType,
      rateType: override.rateType,
      hourlyRate: override.hourlyRate ?? null,
      fixedAmount: override.fixedAmount ?? null,
      bonusHours: override.bonusHours ?? 0,
    };
  }

  const rule = user.rateCard?.rules?.find((r) => r.shiftType === shiftType);
  if (rule) {
    return {
      shiftType,
      rateType: rule.rateType,
      hourlyRate: rule.hourlyRate ?? null,
      fixedAmount: rule.fixedAmount ?? null,
      bonusHours: rule.bonusHours ?? 0,
    };
  }

  const fallbackRate = user.hourlyRate ?? null;
  return {
    shiftType,
    rateType: "HOURLY",
    hourlyRate: fallbackRate,
    fixedAmount: null,
    bonusHours: 0,
  };
}

/**
 * Calculate pay for a time record given resolved rate and hours.
 * - HOURLY (STANDARD, AWAKE_NIGHT, or LONE_WORKING): hours * hourlyRate [+ bonus]
 * - HOURLY + bonus (e.g. LONE_WORKING): hours * hourlyRate + bonusHours * hourlyRate
 * - FIXED (SLEEP_NIGHT – sleep at unit): fixedAmount (ignores hours)
 */
export function calculatePay(rate: ResolvedRate, totalHours: number): number {
  if (rate.rateType === "FIXED" && rate.fixedAmount != null) {
    return Math.round(rate.fixedAmount * 100) / 100;
  }
  const hourly = rate.hourlyRate ?? 0;
  const payFromHours = totalHours * hourly;
  const bonusPay = rate.bonusHours * hourly;
  return Math.round((payFromHours + bonusPay) * 100) / 100;
}
