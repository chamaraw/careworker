import { addMinutes, differenceInMinutes } from "date-fns";

/** How early before shift start staff can clock in at the rostered venue. */
export const CLOCK_IN_EARLY_MINUTES = 30;
/** If no shift is active yet, allow clock-in at the next shift’s venue when it starts within this many minutes. */
export const CLOCK_IN_NEXT_SHIFT_WITHIN_MINUTES = 120;

export type ShiftForClockEligibility = {
  shiftId: string;
  startAt: Date;
  endAt: Date;
  /** Resolved venue: shift override or service user’s home property. */
  venuePropertyId: string | null;
  serviceUserName: string;
};

export type ClockInMatch = {
  shiftId: string;
  propertyId: string;
  serviceUserName: string;
  startAt: Date;
  endAt: Date;
  kind: "active" | "early_next";
};

/**
 * Roster-driven venues where clock-in is allowed without an “off-roster” reason.
 * Handles split days (e.g. AM at property A, PM at property B): only the visit that
 * covers “now” (or the next visit within the early window) is eligible.
 */
export function computeRosterClockInTargets(
  shiftsToday: ShiftForClockEligibility[],
  now: Date
): { expectedPropertyIds: string[]; matched: ClockInMatch[] } {
  const withVenue = shiftsToday.filter((s) => s.venuePropertyId);
  const active: ClockInMatch[] = [];
  for (const s of withVenue) {
    const windowStart = addMinutes(s.startAt, -CLOCK_IN_EARLY_MINUTES);
    if (now >= windowStart && now <= s.endAt) {
      active.push({
        shiftId: s.shiftId,
        propertyId: s.venuePropertyId!,
        serviceUserName: s.serviceUserName,
        startAt: s.startAt,
        endAt: s.endAt,
        kind: "active",
      });
    }
  }
  if (active.length > 0) {
    const expectedPropertyIds = Array.from(new Set(active.map((m) => m.propertyId)));
    return { expectedPropertyIds, matched: active };
  }

  const upcoming = withVenue
    .filter((s) => s.startAt > now)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const next = upcoming[0];
  if (next && differenceInMinutes(next.startAt, now) <= CLOCK_IN_NEXT_SHIFT_WITHIN_MINUTES) {
    const matched: ClockInMatch[] = [
      {
        shiftId: next.shiftId,
        propertyId: next.venuePropertyId!,
        serviceUserName: next.serviceUserName,
        startAt: next.startAt,
        endAt: next.endAt,
        kind: "early_next",
      },
    ];
    return { expectedPropertyIds: [next.venuePropertyId!], matched };
  }

  return { expectedPropertyIds: [], matched: [] };
}

export const OFF_ROSTER_REASON_MIN_LENGTH = 15;
