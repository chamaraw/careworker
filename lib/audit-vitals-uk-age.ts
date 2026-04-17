/**
 * Age-stratified screening-style hints for UK care settings (public / non-diagnostic).
 * Paediatric BP cut-offs are approximate screening comparisons only — clinical assessment
 * uses growth, context, and local policy. See NHS / RCPCH guidance for formal interpretation.
 */

export type UkAgeBand = "infant" | "preschool" | "child" | "adolescent" | "adult" | "older_adult";

export type UkVitalsThresholds = {
  ageBand: UkAgeBand;
  /** Human-readable, e.g. "Adult (35 years)" */
  ageLabel: string;
  bpSysLowBelow: number;
  bpDiaLowBelow: number;
  bpSysRaisedFrom: number;
  bpDiaRaisedFrom: number;
  bpSysUrgentFrom: number;
  bpDiaUrgentFrom: number;
  pulseLowBelow: number;
  pulseHighAbove: number;
  pulseUrgentHighAbove: number;
  pulseUrgentLowBelow: number;
  recheckHoursElevatedBp: number;
  recheckHoursElevatedPulse: number;
};

export function getAgeYearsFromDate(dob: Date, ref: Date = new Date()): number | null {
  if (!dob || Number.isNaN(dob.getTime())) return null;
  let age = ref.getFullYear() - dob.getFullYear();
  const md = ref.getMonth() - dob.getMonth();
  if (md < 0 || (md === 0 && ref.getDate() < dob.getDate())) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

export function getAgeYearsFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return getAgeYearsFromDate(d);
}

function bandForAge(ageYears: number): UkAgeBand {
  if (ageYears < 1) return "infant";
  if (ageYears < 6) return "preschool";
  if (ageYears < 13) return "child";
  if (ageYears < 18) return "adolescent";
  if (ageYears < 65) return "adult";
  return "older_adult";
}

/**
 * Default to adult (18–64) when DOB unknown — same as typical roster BP diary without patient link.
 */
export function getUkVitalsThresholdsForAge(ageYears: number | null): UkVitalsThresholds {
  const age = ageYears === null || ageYears === undefined || ageYears < 0 ? 35 : ageYears;
  const b = bandForAge(age);

  const labelWithAge = (segment: string) =>
    `${segment} (${age} yrs — UK screening-style hints only)`;

  switch (b) {
    case "infant":
      return {
        ageBand: b,
        ageLabel: labelWithAge("Under 1 year"),
        bpSysLowBelow: 70,
        bpDiaLowBelow: 35,
        bpSysRaisedFrom: 100,
        bpDiaRaisedFrom: 65,
        bpSysUrgentFrom: 150,
        bpDiaUrgentFrom: 95,
        pulseLowBelow: 80,
        pulseHighAbove: 150,
        pulseUrgentHighAbove: 180,
        pulseUrgentLowBelow: 60,
        recheckHoursElevatedBp: 2,
        recheckHoursElevatedPulse: 1,
      };
    case "preschool":
      return {
        ageBand: b,
        ageLabel: labelWithAge("Pre-school child (1–5)"),
        bpSysLowBelow: 85,
        bpDiaLowBelow: 45,
        bpSysRaisedFrom: 115,
        bpDiaRaisedFrom: 75,
        bpSysUrgentFrom: 140,
        bpDiaUrgentFrom: 95,
        pulseLowBelow: 70,
        pulseHighAbove: 125,
        pulseUrgentHighAbove: 160,
        pulseUrgentLowBelow: 55,
        recheckHoursElevatedBp: 4,
        recheckHoursElevatedPulse: 2,
      };
    case "child":
      return {
        ageBand: b,
        ageLabel: labelWithAge("School-age child (6–12)"),
        bpSysLowBelow: 90,
        bpDiaLowBelow: 50,
        bpSysRaisedFrom: 125,
        bpDiaRaisedFrom: 82,
        bpSysUrgentFrom: 150,
        bpDiaUrgentFrom: 100,
        pulseLowBelow: 65,
        pulseHighAbove: 115,
        pulseUrgentHighAbove: 150,
        pulseUrgentLowBelow: 50,
        recheckHoursElevatedBp: 4,
        recheckHoursElevatedPulse: 2,
      };
    case "adolescent":
      return {
        ageBand: b,
        ageLabel: labelWithAge("Adolescent (13–17)"),
        bpSysLowBelow: 90,
        bpDiaLowBelow: 55,
        bpSysRaisedFrom: 136,
        bpDiaRaisedFrom: 86,
        bpSysUrgentFrom: 160,
        bpDiaUrgentFrom: 105,
        pulseLowBelow: 60,
        pulseHighAbove: 110,
        pulseUrgentHighAbove: 140,
        pulseUrgentLowBelow: 50,
        recheckHoursElevatedBp: 4,
        recheckHoursElevatedPulse: 2,
      };
    case "adult":
      return {
        ageBand: b,
        ageLabel: labelWithAge("Adult (18–64)"),
        bpSysLowBelow: 90,
        bpDiaLowBelow: 60,
        bpSysRaisedFrom: 140,
        bpDiaRaisedFrom: 90,
        bpSysUrgentFrom: 180,
        bpDiaUrgentFrom: 120,
        pulseLowBelow: 60,
        pulseHighAbove: 100,
        pulseUrgentHighAbove: 130,
        pulseUrgentLowBelow: 45,
        recheckHoursElevatedBp: 4,
        recheckHoursElevatedPulse: 1,
      };
    case "older_adult":
      return {
        ageBand: b,
        ageLabel: labelWithAge("Older adult (65+)"),
        bpSysLowBelow: 90,
        bpDiaLowBelow: 60,
        bpSysRaisedFrom: 140,
        bpDiaRaisedFrom: 90,
        bpSysUrgentFrom: 180,
        bpDiaUrgentFrom: 120,
        pulseLowBelow: 55,
        pulseHighAbove: 105,
        pulseUrgentHighAbove: 130,
        pulseUrgentLowBelow: 45,
        recheckHoursElevatedBp: 4,
        recheckHoursElevatedPulse: 2,
      };
  }
}

/** Plausible manual-entry bounds (mmHg); outside = entry error, not a screening band. */
export const BP_MMHG_SYS_MIN = 50;
export const BP_MMHG_SYS_MAX = 280;
export const BP_MMHG_DIA_MIN = 30;
export const BP_MMHG_DIA_MAX = 200;

export const PULSE_BPM_MIN = 30;
export const PULSE_BPM_MAX = 220;

export type BpClassification = "empty" | "invalid" | "ok" | "low" | "elevated" | "urgent";

export function classifyBloodPressure(
  raw: string,
  ageYears: number | null
): { kind: BpClassification; sys?: number; dia?: number; detail?: string } {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return { kind: "empty" };
  const m = s.match(/^(\d{1,3})\s*[/\s\-]\s*(\d{1,3})$/);
  if (!m) {
    const digitsOnly = /^\d+$/.test(s);
    if (digitsOnly && s.length > 3) {
      return {
        kind: "invalid",
        detail: `Enter two numbers separated by / — e.g. 120/80 (systolic/diastolic, each ${BP_MMHG_SYS_MIN}–${BP_MMHG_SYS_MAX} / ${BP_MMHG_DIA_MIN}–${BP_MMHG_DIA_MAX} mmHg max).`,
      };
    }
    return {
      kind: "invalid",
      detail: `Use format systolic/diastolic e.g. 120/80 (slash or space; max ${BP_MMHG_SYS_MAX}/${BP_MMHG_DIA_MAX} mmHg).`,
    };
  }
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (!Number.isFinite(sys) || !Number.isFinite(dia) || sys <= dia) {
    return {
      kind: "invalid",
      detail: "Systolic must be higher than diastolic (e.g. 130/80).",
    };
  }
  if (sys < BP_MMHG_SYS_MIN || sys > BP_MMHG_SYS_MAX || dia < BP_MMHG_DIA_MIN || dia > BP_MMHG_DIA_MAX) {
    return {
      kind: "invalid",
      detail: `mmHg outside allowed range (systolic ${BP_MMHG_SYS_MIN}–${BP_MMHG_SYS_MAX}, diastolic ${BP_MMHG_DIA_MIN}–${BP_MMHG_DIA_MAX}).`,
    };
  }

  const t = getUkVitalsThresholdsForAge(ageYears);
  if (sys >= t.bpSysUrgentFrom || dia >= t.bpDiaUrgentFrom) {
    return {
      kind: "urgent",
      sys,
      dia,
      detail: `BP ${sys}/${dia} mmHg — very high for ${t.ageLabel}. Seek urgent clinical advice if unwell or persistent.`,
    };
  }
  if (sys < t.bpSysLowBelow || dia < t.bpDiaLowBelow) {
    return {
      kind: "low",
      sys,
      dia,
      detail: `BP ${sys}/${dia} mmHg — below screening range for ${t.ageLabel}. Recheck; seek advice if dizzy or unwell.`,
    };
  }
  if (sys >= t.bpSysRaisedFrom || dia >= t.bpDiaRaisedFrom) {
    return {
      kind: "elevated",
      sys,
      dia,
      detail: `BP ${sys}/${dia} mmHg — above typical screening level for ${t.ageLabel}. Follow local escalation policy.`,
    };
  }
  return { kind: "ok", sys, dia };
}

export type PulseClassification = "empty" | "invalid" | "ok" | "low" | "elevated" | "urgent";

export function classifyPulse(
  raw: string,
  ageYears: number | null
): { kind: PulseClassification; bpm?: number; detail?: string } {
  const s = raw.trim();
  if (!s) return { kind: "empty" };
  if (!/^\d+$/.test(s)) {
    return {
      kind: "invalid",
      detail: `Pulse must be a whole number (${PULSE_BPM_MIN}–${PULSE_BPM_MAX} bpm), no letters or decimals.`,
    };
  }
  const n = Number(s);
  if (!Number.isFinite(n)) {
    return { kind: "invalid", detail: `Enter a whole number (${PULSE_BPM_MIN}–${PULSE_BPM_MAX} bpm).` };
  }
  if (n < PULSE_BPM_MIN || n > PULSE_BPM_MAX) {
    return {
      kind: "invalid",
      detail: `Pulse must be ${PULSE_BPM_MIN}–${PULSE_BPM_MAX} bpm (resting diary range).`,
    };
  }

  const t = getUkVitalsThresholdsForAge(ageYears);
  if (n <= t.pulseUrgentLowBelow || n >= t.pulseUrgentHighAbove) {
    return {
      kind: "urgent",
      bpm: n,
      detail: `Pulse ${n} bpm — outside safe screening window for ${t.ageLabel}. Seek advice if unwell.`,
    };
  }
  if (n < t.pulseLowBelow) {
    return {
      kind: "low",
      bpm: n,
      detail: `Pulse ${n} bpm — low for ${t.ageLabel} at rest. Recheck after rest; escalate if symptomatic.`,
    };
  }
  if (n > t.pulseHighAbove) {
    return {
      kind: "elevated",
      bpm: n,
      detail: `Pulse ${n} bpm — high for ${t.ageLabel} at rest. Consider rest and recheck per plan.`,
    };
  }
  return { kind: "ok", bpm: n };
}
