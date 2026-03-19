import { startOfWeek, endOfWeek } from "date-fns";
import type { ShiftType } from "@prisma/client";

/** Default hourly rate when user has none set (for display only). */
export const DEFAULT_HOURLY_RATE = 11.0;

export type PayrollDay = {
  date: string;
  dateLabel: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  breakMinutes: number;
  totalMinutes: number;
  totalHours: number;
  shiftType: ShiftType;
  propertyId: string | null;
  propertyName: string | null;
};

export type PropertyBreakdownItem = {
  propertyId: string | null;
  propertyName: string | null;
  hours: number;
  pay: number;
};

export type PayrollWorker = {
  userId: string;
  name: string;
  email: string;
  hourlyRate: number | null;
  days: PayrollDay[];
  totalMinutes: number;
  totalHours: number;
  totalPay: number | null;
  propertyBreakdown: PropertyBreakdownItem[];
};

export function getWeekBounds(referenceDate: Date): { weekStart: Date; weekEnd: Date } {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return { weekStart, weekEnd };
}
