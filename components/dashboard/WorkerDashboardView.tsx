"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Calendar, Clock, BookOpen, HeartPulse, ArrowRight, ClipboardList, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkerAuditReminderItem } from "@/lib/audit-reminders";
import { LiveDateTimeDisplay } from "@/components/hours/LiveDateTimeDisplay";
import { QuickActions } from "./QuickActions";

/** NHS-inspired palette: Blue #005EB8, Dark Blue, Aqua #00A499, Green #007F3B, Grey #E8EDEE */
const NHS = {
  blue: "#005EB8",
  blueDark: "#003d7a",
  aqua: "#00A499",
  green: "#007F3B",
  pale: "#E8EDEE",
};

export type WorkerCompetencyRow = {
  requirementId: string;
  name: string;
  status: string;
  completedAt: string | null;
  expiresAt: string | null;
};

export function WorkerDashboardView({
  userName,
  shiftsToday,
  recentJournal,
  hoursThisWeek,
  auditReminders = [],
  competencyBanner,
  competencyRows = [],
  hoursSection,
}: {
  userName: string;
  shiftsToday: {
    id: string;
    startAt: string;
    endAt: string;
    serviceUserName: string;
    venueLabel: string | null;
  }[];
  recentJournal: { id: string; serviceUserName: string; category: string; recordedAt: string }[];
  hoursThisWeek: string;
  auditReminders?: WorkerAuditReminderItem[];
  /** When set, nudge about training renewals (links to notification bell). */
  competencyBanner?: { expiredCount: number; expiringCount: number; missingCount: number };
  /** Applicable training rows with renewal / expiry (same source as workforce matrix). */
  competencyRows?: readonly WorkerCompetencyRow[];
  /** Clock, banner, and timesheet (server-rendered slot below quick actions). */
  hoursSection?: ReactNode;
}) {
  const competencyTotal =
    (competencyBanner?.expiredCount ?? 0) +
    (competencyBanner?.expiringCount ?? 0) +
    (competencyBanner?.missingCount ?? 0);

  const competencySorted = [...competencyRows].sort((a, b) => {
    const rank = (s: string) =>
      s === "EXPIRED" ? 0 : s === "EXPIRING" ? 1 : s === "MISSING" ? 2 : s === "VALID" ? 3 : 4;
    const dr = rank(a.status) - rank(b.status);
    if (dr !== 0) return dr;
    const ae = a.expiresAt ? parseISO(a.expiresAt).getTime() : Infinity;
    const be = b.expiresAt ? parseISO(b.expiresAt).getTime() : Infinity;
    return ae - be;
  });

  function formatShortDate(iso: string | null) {
    if (!iso) return "—";
    try {
      return format(parseISO(iso), "d MMM yyyy");
    } catch {
      return iso.slice(0, 10);
    }
  }

  const exp = competencyBanner?.expiredCount ?? 0;
  const ex = competencyBanner?.expiringCount ?? 0;
  const miss = competencyBanner?.missingCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Hero — NHS blue healthcare feel (training alerts live below main content so login feels welcoming first) */}
      <section
        className="relative rounded-xl border border-[#005EB8]/30 shadow-md [background-clip:padding-box]"
        style={{
          background: `linear-gradient(145deg, ${NHS.blue} 0%, ${NHS.blueDark} 55%, #001f4d 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl opacity-[0.07] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v6h2v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
          aria-hidden
        />
        <div className="relative px-4 py-5 sm:px-6 sm:py-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2 min-w-0 max-w-xl">
              <p className="inline-flex items-center gap-1.5 text-white/85 text-[11px] font-semibold uppercase tracking-wider">
                <HeartPulse className="size-4 text-[#41B6E6] shrink-0" aria-hidden />
                Care team
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
                Welcome back, {userName}
              </h1>
              <p className="text-sm sm:text-[15px] text-white/80 leading-snug max-w-lg">
                Your shift snapshot and quick links — clear, calm handovers.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="#worker-hours"
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "min-h-[44px] min-w-0 max-w-full bg-white px-3 py-2 text-[#005EB8] hover:bg-[#E8EDEE] font-semibold shadow-sm inline-flex w-full sm:w-auto flex-1 sm:flex-initial items-center justify-center gap-2 touch-manipulation"
                  )}
                >
                  <Clock className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 text-center sm:text-left text-sm leading-snug break-words">
                    Hours &amp; clock
                  </span>
                  <ArrowRight className="size-4 shrink-0 opacity-80 hidden sm:inline" aria-hidden />
                </a>
                <Link
                  href="/roster"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "default" }),
                    "min-h-[44px] min-w-0 border-white/40 bg-white/10 px-3 py-2 text-white text-sm hover:bg-white/20 inline-flex flex-1 sm:flex-initial items-center justify-center touch-manipulation break-words text-center"
                  )}
                >
                  Roster
                </Link>
              </div>
            </div>
            <div className="w-full max-w-[20rem] mx-auto lg:mx-0 shrink-0">
              <LiveDateTimeDisplay variant="onDarkCompact" />
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles — color-coded NHS accents */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className="border-2 overflow-hidden"
          style={{ borderColor: NHS.aqua, background: `linear-gradient(180deg, ${NHS.pale} 0%, white 40%)` }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-[#005EB8] font-semibold uppercase tracking-wide text-xs flex items-center gap-2">
              <Calendar className="size-4" style={{ color: NHS.aqua }} />
              Today
            </CardDescription>
            <CardTitle className="text-4xl tabular-nums" style={{ color: NHS.blue }}>
              {shiftsToday.length}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-medium">Shifts scheduled for you</p>
          </CardHeader>
        </Card>
        <Card
          className="border-2 overflow-hidden"
          style={{ borderColor: NHS.green, background: `linear-gradient(180deg, #ecfdf5 0%, white 45%)` }}
        >
          <CardHeader className="pb-2">
            <CardDescription className="font-semibold uppercase tracking-wide text-xs flex items-center gap-2" style={{ color: NHS.green }}>
              <Clock className="size-4" />
              This week
            </CardDescription>
            <CardTitle className="text-4xl tabular-nums" style={{ color: NHS.green }}>
              {hoursThisWeek}
              <span className="text-xl font-semibold text-muted-foreground ml-1">h</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground font-medium">Hours recorded (all statuses)</p>
          </CardHeader>
        </Card>
      </div>

      <QuickActions />

      {hoursSection}

      {auditReminders.length > 0 ? (
        <Card
          className="border-2 overflow-hidden shadow-md"
          style={{ borderColor: NHS.blue, background: `linear-gradient(180deg, #eff6ff 0%, white 45%)` }}
        >
          <CardHeader>
            <CardTitle className="section-title flex items-center gap-2 text-[#005EB8]">
              <ClipboardList className="size-5 text-[#005EB8]" aria-hidden />
              Audits to complete today
            </CardTitle>
            <CardDescription>
              Linked to your shifts and patients. Twice-daily forms (e.g. blood pressure diary) need two filings today
              unless your policy says otherwise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditReminders.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#005EB8]/20 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    {item.templateName}{" "}
                    <span className="font-normal text-muted-foreground">— {item.serviceUserName}</span>
                  </p>
                  <p className="text-sm text-[#005EB8]">
                    {item.propertyName} · Shift {item.shiftWindowLabel} · {item.haveToday}/{item.neededToday} done today
                  </p>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                </div>
                <Link
                  href={item.openPath}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "min-h-[48px] shrink-0 bg-[#005EB8] hover:bg-[#004a94] text-white inline-flex items-center justify-center"
                  )}
                >
                  Open form
                  <ArrowRight className="size-4 ml-2 opacity-90" aria-hidden />
                </Link>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              This list updates from your roster and assigned audit templates for the venue. Submitting saves to the
              patient&apos;s audit history.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 border-[#005EB8]/20 shadow-sm">
          <CardHeader>
            <CardTitle className="section-title flex items-center gap-2 text-[#005EB8]">
              <Calendar className="size-5 text-[#00A499]" />
              My shifts today
            </CardTitle>
            <CardDescription>Who you&apos;re supporting and when</CardDescription>
          </CardHeader>
          <CardContent>
            {shiftsToday.length === 0 ? (
              <p className="text-muted-foreground">No shifts scheduled for you today.</p>
            ) : (
              <ul className="space-y-3">
                {shiftsToday.map((shift) => (
                  <li
                    key={shift.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-[#E8EDEE] last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground">{shift.serviceUserName}</span>
                      {shift.venueLabel ? (
                        <span className="block text-sm text-muted-foreground mt-0.5">
                          Venue: {shift.venueLabel}
                        </span>
                      ) : (
                        <span className="block text-sm text-amber-800 mt-0.5">
                          Venue not set on roster — ask your manager before clock-in.
                        </span>
                      )}
                    </div>
                    <span className="text-[#005EB8] font-medium tabular-nums shrink-0">
                      {format(parseISO(shift.startAt), "HH:mm")} – {format(parseISO(shift.endAt), "HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-[#007F3B]/25 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="section-title flex items-center gap-2 text-[#007F3B]">
                <BookOpen className="size-5" />
                Recent notes
              </CardTitle>
              <CardDescription>Latest entries you&apos;ve recorded</CardDescription>
            </div>
            <Link
              href="/notes"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-[44px] border-[#007F3B]/40 inline-flex items-center justify-center"
              )}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentJournal.length === 0 ? (
              <p className="text-muted-foreground">No recent entries.</p>
            ) : (
              <ul className="space-y-3">
                {recentJournal.map((entry) => (
                  <li
                    key={entry.id}
                    className="py-3 border-b border-[#E8EDEE] last:border-0 body-text text-sm"
                  >
                    <span className="font-semibold text-foreground">{entry.serviceUserName}</span>
                    {" "}
                    <span className="text-[#005EB8]">— {entry.category}</span>
                    {" "}
                    <span className="text-muted-foreground">
                      — {format(parseISO(entry.recordedAt), "MMM d, HH:mm")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {competencySorted.length > 0 ? (
        <details
          className="group rounded-xl border border-[#005EB8]/20 bg-white shadow-sm overflow-hidden scroll-mt-20"
          open={competencyTotal > 0}
        >
          <summary className="cursor-pointer list-none flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5 sm:py-4 bg-[#E8EDEE]/70 hover:bg-[#E8EDEE] transition-colors [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-5 shrink-0 text-[#005EB8] mt-0.5 transition-transform group-open:rotate-180"
              aria-hidden
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-[#005EB8] text-base">Training & competencies</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {competencyTotal > 0 ? (
                  <>
                    <span className="text-foreground font-medium">Action needed:</span>{" "}
                    {exp > 0 ? <span className="text-red-800 font-medium">{exp} expired</span> : null}
                    {exp > 0 && (ex > 0 || miss > 0) ? " · " : null}
                    {ex > 0 ? <span className="text-amber-900 font-medium">{ex} due within 60 days</span> : null}
                    {ex > 0 && miss > 0 ? " · " : null}
                    {miss > 0 ? <span className="text-red-800 font-medium">{miss} not yet recorded</span> : null}.
                    Use the notifications bell for reminders; your manager updates records in workforce compliance.
                  </>
                ) : (
                  <>
                    All tracked topics are in date. Open this section anytime to see{" "}
                    <span className="text-foreground font-medium">renewal / expiry dates</span> for each requirement.
                  </>
                )}
              </p>
            </div>
          </summary>
          <div className="border-t border-[#E8EDEE] px-4 pb-4 pt-3 sm:px-5 space-y-3">
            {competencyTotal > 0 ? (
              <p
                className="text-sm rounded-lg border border-amber-200/80 bg-amber-50/90 text-amber-950 px-3 py-2.5 leading-relaxed"
                role="status"
              >
                Complete refresher training as needed, then ask your manager to log the new completion date so your
                expiry dates stay accurate.
              </p>
            ) : null}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm border-collapse min-w-[280px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">Topic</th>
                    <th className="py-2 pr-3 font-medium whitespace-nowrap">Status</th>
                    <th className="py-2 pr-3 font-medium whitespace-nowrap">Completed</th>
                    <th className="py-2 font-medium whitespace-nowrap">Expires / renew by</th>
                  </tr>
                </thead>
                <tbody>
                  {competencySorted.map((row) => (
                    <tr key={row.requirementId} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-3 align-top font-medium text-slate-900">{row.name}</td>
                      <td className="py-2.5 pr-3 align-top">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-semibold",
                            row.status === "VALID" && "bg-[#ecfdf5] text-[#007F3B]",
                            row.status === "EXPIRING" && "bg-amber-100 text-amber-950",
                            (row.status === "EXPIRED" || row.status === "MISSING") && "bg-red-100 text-red-900",
                            !["VALID", "EXPIRING", "EXPIRED", "MISSING"].includes(row.status) &&
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 align-top text-muted-foreground whitespace-nowrap">
                        {formatShortDate(row.completedAt)}
                      </td>
                      <td className="py-2.5 align-top text-muted-foreground whitespace-nowrap">
                        {formatShortDate(row.expiresAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
