/**
 * National-average baseline for care worker performance benchmarking.
 * Based on specific care tasks (chore, medicine, bath). Expected time per shift
 * is derived from typical task mix for each care need level.
 */

/** Expected minutes per task (national average). Used to build shift baselines. */
export const BASELINE_MINUTES_PER_TASK: Record<string, number> = {
  chore: 15,
  medicine: 10,
  bath: 25,
  personal_care: 20,
  meal_support: 15,
};

/** Typical task mix per care need: low = chore + medicine; medium = + personal_care; high = + bath. */
const TASK_MIX_LOW = ["chore", "medicine"];
const TASK_MIX_MEDIUM = ["chore", "medicine", "personal_care"];
const TASK_MIX_HIGH = ["chore", "medicine", "personal_care", "bath"];

function sumTaskMinutes(tasks: string[]): number {
  return tasks.reduce((sum, t) => sum + (BASELINE_MINUTES_PER_TASK[t] ?? 0), 0);
}

/** Expected minutes per shift by care need (derived from task baselines). */
export const BASELINE_MINUTES_PER_SHIFT: Record<string, number> = {
  low: sumTaskMinutes(TASK_MIX_LOW),
  medium: sumTaskMinutes(TASK_MIX_MEDIUM),
  high: sumTaskMinutes(TASK_MIX_HIGH),
};

export const DEFAULT_BASELINE_MINUTES = sumTaskMinutes(TASK_MIX_MEDIUM);

/** Target completion rate (0–1). */
export const BASELINE_COMPLETION_RATE = 0.9;

/** Incidents per 100 approved hours. */
export const BASELINE_INCIDENTS_PER_100H = 2;

/** Journal entries per 10 approved hours. */
export const BASELINE_JOURNAL_PER_10H = 4;
