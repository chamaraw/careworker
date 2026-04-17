"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ManagerPropertySummary, ManagerUpcomingAuditRow } from "./manager-actions";
import { MANAGER_FILING_WINDOW_DAYS } from "./manager-constants";

type ClockAttendanceSnapshot = {
  onShift: Array<{
    id: string;
    workerName: string;
    propertyName: string;
    clockInAt: string;
    clockOutAt: string | null;
    totalMinutes: number | null;
    shiftType: string;
    offRosterReason: string | null;
    linkedRosterServiceUserName: string | null;
  }>;
  recentCompleted: Array<{
    id: string;
    workerName: string;
    propertyName: string;
    clockInAt: string;
    clockOutAt: string | null;
    totalMinutes: number | null;
    shiftType: string;
    offRosterReason: string | null;
    linkedRosterServiceUserName: string | null;
  }>;
};

type FilterTab = "all" | "pending" | "overdue" | "complete";

function pct(n: number, d: number) {
  if (d <= 0) return 0;
  return Math.min(100, Math.round((n / d) * 100));
}

function cardTone(row: ManagerPropertySummary): "neutral" | "ok" | "warn" | "bad" {
  if (row.totalAssignedTemplates === 0) return "neutral";
  if (row.overdueScheduledCount > 0) return "bad";
  if (row.missingInPeriodCount > 0) return "warn";
  return "ok";
}

const FILING_LABEL: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

/** Display YYYY-MM-DD without timezone shifting the calendar day. */
function formatClockCell(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function formatMins(m: number | null) {
  if (m == null || m <= 0) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h <= 0) return `${min}m`;
  return min ? `${h}h ${min}m` : `${h}h`;
}

function formatLondonDueYmd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ManagerDashboardClient({
  initialData,
  upcomingCompliance = [],
  clockAttendance,
}: {
  initialData: ManagerPropertySummary[];
  upcomingCompliance?: ManagerUpcomingAuditRow[];
  clockAttendance: ClockAttendanceSnapshot;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialData.filter((row) => {
      if (q && !row.propertyName.toLowerCase().includes(q)) return false;
      if (filter === "all") return true;
      if (filter === "pending") return row.missingInPeriodCount > 0;
      if (filter === "overdue") return row.overdueScheduledCount > 0;
      if (filter === "complete") {
        return (
          row.totalAssignedTemplates > 0 &&
          row.missingInPeriodCount === 0 &&
          row.overdueScheduledCount === 0
        );
      }
      return true;
    });
  }, [initialData, filter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#005EB8]">Audit manager</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl leading-relaxed">
            Track which venues have audit templates assigned, what was filed in the last{" "}
            <strong className="text-foreground">{MANAGER_FILING_WINDOW_DAYS} days</strong>, overdue schedules, open
            follow-up actions, and <strong className="text-foreground">staff clock in/out</strong>. Open a property to
            see each form’s status and links to file or review.
          </p>
        </div>
        <Link
          href="/audits"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-[44px] touch-manipulation shrink-0 inline-flex items-center justify-center px-3 sm:px-4 text-center max-w-full sm:max-w-[12rem] whitespace-normal leading-snug"
          )}
        >
          Back to Audits hub
        </Link>
      </div>

      <Card className="border-[#005EB8]/25 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg text-[#005EB8]">Staff clock in &amp; out</CardTitle>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
                Pulled from the same time records as <strong className="text-foreground">Payroll</strong>. Staff normally
                clock in at their <strong className="text-foreground">rostered venue</strong> for the active visit;{" "}
                <strong className="text-foreground">off-roster reasons</strong> (e.g. hospital) appear when they used a
                different property. Open Payroll to filter by worker or date and approve timesheets.
              </p>
            </div>
            <Link
              href="/payroll"
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "min-h-[44px] shrink-0 touch-manipulation self-start sm:self-auto"
              )}
            >
              Open Payroll
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {clockAttendance.onShift.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#00A499] mb-2">Currently on shift</p>
              <div className="overflow-x-auto rounded border border-[#E8EDEE]">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b bg-[#E8EDEE]/60 text-left text-muted-foreground">
                      <th className="py-2 px-2 font-medium">Staff</th>
                      <th className="py-2 px-2 font-medium">Venue</th>
                      <th className="py-2 px-2 font-medium">Clock in</th>
                      <th className="py-2 px-2 font-medium">Shift type</th>
                      <th className="py-2 px-2 font-medium min-w-[8rem]">Roster / exception</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clockAttendance.onShift.map((r) => (
                      <tr key={r.id} className="border-b border-[#E8EDEE] last:border-0">
                        <td className="py-2 px-2 font-medium text-foreground">{r.workerName}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.propertyName}</td>
                        <td className="py-2 px-2 tabular-nums whitespace-nowrap">{formatClockCell(r.clockInAt)}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.shiftType.replace(/_/g, " ")}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground max-w-[14rem]">
                          {r.linkedRosterServiceUserName ? (
                            <span className="text-foreground font-medium block">Roster: {r.linkedRosterServiceUserName}</span>
                          ) : null}
                          {r.offRosterReason ? (
                            <span className="text-amber-950 block mt-0.5" title={r.offRosterReason}>
                              Off-roster: {r.offRosterReason.length > 72 ? `${r.offRosterReason.slice(0, 72)}…` : r.offRosterReason}
                            </span>
                          ) : !r.linkedRosterServiceUserName ? (
                            <span>—</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No one is currently clocked in.</p>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#005EB8] mb-2">
              Recent clock-outs (14 days)
            </p>
            {clockAttendance.recentCompleted.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed clocks in this window.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-[#E8EDEE]">
                <table className="w-full text-sm min-w-[880px]">
                  <thead>
                    <tr className="border-b bg-[#E8EDEE]/60 text-left text-muted-foreground">
                      <th className="py-2 px-2 font-medium">Staff</th>
                      <th className="py-2 px-2 font-medium">Venue</th>
                      <th className="py-2 px-2 font-medium">In</th>
                      <th className="py-2 px-2 font-medium">Out</th>
                      <th className="py-2 px-2 font-medium">Duration</th>
                      <th className="py-2 px-2 font-medium min-w-[8rem]">Roster / exception</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clockAttendance.recentCompleted.map((r) => (
                      <tr key={r.id} className="border-b border-[#E8EDEE] last:border-0">
                        <td className="py-2 px-2 font-medium text-foreground">{r.workerName}</td>
                        <td className="py-2 px-2 text-muted-foreground">{r.propertyName}</td>
                        <td className="py-2 px-2 tabular-nums whitespace-nowrap">{formatClockCell(r.clockInAt)}</td>
                        <td className="py-2 px-2 tabular-nums whitespace-nowrap">
                          {r.clockOutAt ? formatClockCell(r.clockOutAt) : "—"}
                        </td>
                        <td className="py-2 px-2 tabular-nums">{formatMins(r.totalMinutes)}</td>
                        <td className="py-2 px-2 text-xs text-muted-foreground max-w-[14rem]">
                          {r.linkedRosterServiceUserName ? (
                            <span className="text-foreground font-medium block">Roster: {r.linkedRosterServiceUserName}</span>
                          ) : null}
                          {r.offRosterReason ? (
                            <span className="text-amber-950 block mt-0.5" title={r.offRosterReason}>
                              Off-roster: {r.offRosterReason.length > 72 ? `${r.offRosterReason.slice(0, 72)}…` : r.offRosterReason}
                            </span>
                          ) : !r.linkedRosterServiceUserName ? (
                            <span>—</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter properties">
          {(
            [
              ["all", "All properties"],
              ["pending", "Pending filing"],
              ["overdue", "Schedule overdue"],
              ["complete", "Up to date"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant={filter === key ? "default" : "outline"}
              size="sm"
              className={cn(
                "min-h-[40px] touch-manipulation whitespace-normal text-center leading-tight px-2.5 sm:px-3 max-w-[9.5rem] sm:max-w-none",
                filter === key && "bg-[#005EB8] hover:bg-[#004a94]"
              )}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search property…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md min-h-[44px] text-base"
          aria-label="Search properties by name"
        />
      </div>

      {upcomingCompliance.length > 0 ? (
        <Card className="border-[#005EB8]/25 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-[#005EB8]">Upcoming filings (by template frequency)</CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Uses each form&apos;s filing frequency (daily / weekly / monthly / quarterly / annual) and recent
              submissions. Monthly can target a calendar day (1–28) or end-of-month when left blank on the template.
            </p>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Property</th>
                  <th className="py-2 pr-3 font-medium">Form</th>
                  <th className="py-2 pr-3 font-medium">Frequency</th>
                  <th className="py-2 pr-3 font-medium">Due (UK)</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Last filing</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcomingCompliance.slice(0, 80).map((row) => (
                  <tr key={`${row.propertyId}-${row.formTemplateId}`} className="border-b border-[#E8EDEE] last:border-0">
                    <td className="py-2 pr-3 align-top">{row.propertyName}</td>
                    <td className="py-2 pr-3 align-top font-medium text-foreground">{row.templateName}</td>
                    <td className="py-2 pr-3 align-top whitespace-nowrap">
                      {FILING_LABEL[row.filingFrequency] ?? row.filingFrequency}
                      {row.filingFrequency === "MONTHLY" && row.monthlyFilingDueDay != null
                        ? ` · day ${row.monthlyFilingDueDay}`
                        : row.filingFrequency === "MONTHLY"
                          ? " · end of month"
                          : ""}
                    </td>
                    <td className="py-2 pr-3 align-top whitespace-nowrap tabular-nums">
                      <span className="font-medium text-foreground">{formatLondonDueYmd(row.dueDateLondon)}</span>
                      <span className="block text-xs text-muted-foreground font-normal">{row.dueDateLondon}</span>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          row.complianceStatus === "OVERDUE" && "border-red-300 bg-red-50 text-red-900",
                          row.complianceStatus === "DUE_THIS_PERIOD" && "border-amber-300 bg-amber-50 text-amber-950",
                          row.complianceStatus === "DUE_SOON" && "border-[#005EB8]/40 bg-sky-50 text-[#003d7a]"
                        )}
                      >
                        {row.complianceStatus.replace(/_/g, " ")}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{row.complianceDetail}</p>
                    </td>
                    <td className="py-2 pr-3 align-top text-muted-foreground whitespace-nowrap">
                      {row.lastSubmittedAt
                        ? new Date(row.lastSubmittedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 align-top">
                      <Link
                        href={`/audits/property/${row.propertyId}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "min-h-[40px] touch-manipulation"
                        )}
                      >
                        Property
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {upcomingCompliance.length > 80 ? (
              <p className="text-xs text-muted-foreground mt-2">Showing 80 of {upcomingCompliance.length} rows.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((row) => {
          const tone = cardTone(row);
          const p = pct(row.filedInPeriodCount, row.totalAssignedTemplates);
          return (
            <Card
              key={row.propertyId}
              className={cn(
                "border shadow-sm overflow-hidden",
                tone === "bad" && "border-red-200",
                tone === "warn" && "border-amber-200",
                tone === "ok" && "border-[#007F3B]/30"
              )}
            >
              <CardHeader className="pb-2 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">{row.propertyName}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {row.totalAssignedTemplates === 0 ? (
                      <Badge variant="secondary">No forms assigned</Badge>
                    ) : tone === "bad" ? (
                      <Badge className="bg-red-600 hover:bg-red-600">Schedule overdue</Badge>
                    ) : tone === "warn" ? (
                      <Badge className="bg-amber-600 hover:bg-amber-600 text-white">Missing filings</Badge>
                    ) : (
                      <Badge className="bg-[#007F3B] hover:bg-[#006b32]">Up to date</Badge>
                    )}
                  </div>
                </div>
                {row.totalAssignedTemplates > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Filed ({MANAGER_FILING_WINDOW_DAYS}d):{" "}
                        <strong className="text-foreground tabular-nums">
                          {row.filedInPeriodCount} / {row.totalAssignedTemplates}
                        </strong>
                      </span>
                      <span className="tabular-nums">{p}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#E8EDEE] overflow-hidden" aria-hidden>
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300",
                          tone === "ok" ? "bg-[#007F3B]" : tone === "warn" ? "bg-amber-500" : "bg-[#005EB8]"
                        )}
                        style={{ width: `${p}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Enable templates on the property page so staff see them in Audit recording.
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground space-x-2">
                  <span>
                    Missing: <strong className="text-foreground tabular-nums">{row.missingInPeriodCount}</strong>
                  </span>
                  <span className="text-[#E8EDEE]">·</span>
                  <span>
                    Overdue schedules:{" "}
                    <strong className="text-foreground tabular-nums">{row.overdueScheduledCount}</strong>
                  </span>
                  <span className="text-[#E8EDEE]">·</span>
                  <span>
                    Open actions: <strong className="text-foreground tabular-nums">{row.openActionsCount}</strong>
                  </span>
                  <span className="text-[#E8EDEE]">·</span>
                  <span>
                    Service users: <strong className="text-foreground tabular-nums">{row.serviceUserCount}</strong>
                  </span>
                  <span className="text-[#E8EDEE]">·</span>
                  <span>
                    Missing (people):{" "}
                    <strong className="text-foreground tabular-nums">{row.serviceUsersWithMissingCount}</strong>
                  </span>
                </div>
                <Link
                  href={`/audits/property/${row.propertyId}`}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "min-h-[44px] touch-manipulation shrink-0 bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground whitespace-normal text-center sm:text-left leading-tight px-3 max-w-[10rem] sm:max-w-none"
                  )}
                >
                  View details
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No properties match this filter or search.</p>
      ) : null}
    </div>
  );
}
