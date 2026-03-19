"use client";

import { format } from "date-fns";

const SHIFT_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  LONE_WORKING: "Lone working",
  SLEEP_NIGHT: "Sleep night",
};

export type SalarySlipDay = {
  date: string;
  dateLabel: string;
  clockInAt: string;
  clockOutAt: string | null;
  breakMinutes: number;
  totalMinutes: number;
  totalHours: number;
  shiftType?: string;
  propertyName?: string | null;
};

type PropertyBreakdownItem = {
  propertyId: string | null;
  propertyName: string | null;
  hours: number;
  pay: number;
};

export function SalarySlip({
  workerName,
  workerEmail,
  weekLabel,
  days,
  totalHours,
  hourlyRate,
  totalPay,
  propertyBreakdown = [],
}: {
  workerName: string;
  workerEmail: string;
  weekLabel: string;
  days: SalarySlipDay[];
  totalHours: number;
  hourlyRate: number | null;
  totalPay: number | null;
  propertyBreakdown?: PropertyBreakdownItem[];
}) {
  return (
    <div className="salary-slip bg-white text-stone-900 max-w-3xl w-full mx-auto p-6 sm:p-8 md:p-10 shadow-lg rounded-lg border border-stone-200 print:shadow-none print:border print:p-6 print:max-w-none">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .salary-slip { box-shadow: none; border: 1px solid #e5e7eb; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="border-b-2 border-teal-600 pb-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-teal-800 tracking-tight">
          Filey Care
        </h1>
        <p className="text-sm sm:text-base text-stone-500 mt-0.5">Salary slip</p>
      </div>

      {/* Period & worker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 text-base sm:text-lg">
        <div>
          <p className="font-semibold text-stone-700">Pay period</p>
          <p className="text-stone-600">{weekLabel}</p>
        </div>
        <div>
          <p className="font-semibold text-stone-700">Care worker</p>
          <p className="text-stone-600">{workerName}</p>
          <p className="text-stone-500 text-sm sm:text-base">{workerEmail}</p>
        </div>
      </div>

      {/* Hours by day */}
      <div className="mb-6">
        <h2 className="text-sm sm:text-base font-semibold text-stone-700 mb-3 uppercase tracking-wide">
          Hours breakdown
        </h2>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-base sm:text-lg border-collapse min-w-[320px]">
            <thead>
              <tr className="bg-stone-100 text-left">
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium">Date</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium">Property</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium">Shift type</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium">Clock in</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium">Clock out</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium text-right">Break (min)</th>
                <th className="border border-stone-200 px-3 sm:px-4 py-3 font-medium text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {days.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-stone-200 px-3 sm:px-4 py-6 text-stone-500 text-center">
                    No approved hours for this period
                  </td>
                </tr>
              ) : (
                days.map((d, i) => (
                  <tr key={`${d.date}-${i}`} className="border-b border-stone-200">
                    <td className="border border-stone-200 px-3 sm:px-4 py-3">{d.dateLabel}</td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3 text-stone-600">
                      {d.propertyName ?? "—"}
                    </td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3">
                      {d.shiftType ? (SHIFT_LABELS[d.shiftType] ?? d.shiftType) : "—"}
                    </td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3">
                      {format(new Date(d.clockInAt), "HH:mm")}
                    </td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3">
                      {d.clockOutAt ? format(new Date(d.clockOutAt), "HH:mm") : "—"}
                    </td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3 text-right">
                      {d.breakMinutes}
                    </td>
                    <td className="border border-stone-200 px-3 sm:px-4 py-3 text-right font-medium">
                      {d.totalHours.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay by property */}
      {propertyBreakdown.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm sm:text-base font-semibold text-stone-700 mb-2 uppercase tracking-wide">
            Pay by property (cost allocation)
          </h2>
          <ul className="space-y-1 text-base">
            {propertyBreakdown.map((p) => (
              <li key={p.propertyId ?? "none"} className="flex justify-between">
                <span className="text-stone-600">{p.propertyName ?? "No property"}</span>
                <span>{p.hours.toFixed(2)} h → £{p.pay.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Totals */}
      <div className="border-t-2 border-stone-200 pt-4 space-y-2 text-base sm:text-lg">
        <div className="flex justify-between">
          <span className="text-stone-600">Total hours</span>
          <span className="font-semibold">{totalHours.toFixed(2)}</span>
        </div>
        {hourlyRate != null && (
          <div className="flex justify-between">
            <span className="text-stone-600">Fallback hourly rate</span>
            <span>£{hourlyRate.toFixed(2)}</span>
          </div>
        )}
        {totalPay != null && (
          <div className="flex justify-between text-lg sm:text-xl font-bold mt-2 pt-2 border-t border-stone-200">
            <span>Total pay</span>
            <span className="text-teal-700">£{totalPay.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs sm:text-sm text-stone-400 mt-8">
        Generated from approved time records. Filey Care Worker — payroll.
      </p>

      <div className="no-print mt-8">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-3 sm:px-6 sm:py-3 bg-teal-600 text-white rounded-lg text-base font-medium hover:bg-teal-700 min-h-[44px] touch-manipulation"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
