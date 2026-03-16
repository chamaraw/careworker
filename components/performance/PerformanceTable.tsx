"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkerPerformanceRow } from "@/app/(dashboard)/performance/actions";
import { cn } from "@/lib/utils";

function VarianceBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const over = value > 0;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        over ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
      )}
    >
      {over ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export function PerformanceTable({ rows }: { rows: WorkerPerformanceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="body-text-muted py-8 text-center">
        No performance data for the selected filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-base font-semibold w-12">Rank</TableHead>
            <TableHead className="text-base font-semibold">Care worker</TableHead>
            <TableHead className="text-base font-semibold">Venue</TableHead>
            <TableHead className="text-base font-semibold text-right">Approved h</TableHead>
            <TableHead className="text-base font-semibold text-right">Expected h</TableHead>
            <TableHead className="text-base font-semibold text-right">Time variance</TableHead>
            <TableHead className="text-base font-semibold text-right">Completion</TableHead>
            <TableHead className="text-base font-semibold text-right">Shifts</TableHead>
            <TableHead className="text-base font-semibold text-right">Journal</TableHead>
            <TableHead className="text-base font-semibold text-right">Incidents</TableHead>
            <TableHead className="text-base font-semibold text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.workerId}-${r.propertyId ?? "all"}-${i}`} className="text-base">
              <TableCell className="tabular-nums font-medium">
                {r.rank != null ? `#${r.rank}` : "—"}
              </TableCell>
              <TableCell className="font-medium">{r.workerName}</TableCell>
              <TableCell className="text-[var(--muted-foreground)]">
                {r.propertyName ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.approvedHours.toFixed(1)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {r.expectedHours > 0 ? r.expectedHours.toFixed(1) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <VarianceBadge value={r.timeVariancePct} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {r.completionRatePct != null ? `${r.completionRatePct.toFixed(0)}%` : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.shiftsCompleted} / {r.shiftsScheduled}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.journalEntries}
                {r.approvedHours > 0 && (
                  <span className="text-muted-foreground text-sm ml-1">
                    ({r.journalPer10h.toFixed(1)}/10h)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.incidents}
                {r.approvedHours > 0 && (
                  <span className="text-muted-foreground text-sm ml-1">
                    ({r.incidentsPer100h.toFixed(1)}/100h)
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {r.performanceIndex != null ? (
                  <span
                    className={cn(
                      "tabular-nums font-semibold",
                      r.performanceIndex >= 100
                        ? "text-emerald-600 dark:text-emerald-400"
                        : r.performanceIndex >= 85
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {r.performanceIndex}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
