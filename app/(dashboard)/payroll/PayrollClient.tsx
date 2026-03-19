"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useTransition, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PayrollWorker } from "./actions";
import { TimesheetTable } from "@/components/hours/TimesheetTable";
import { AddTimeRecordDialog } from "@/components/hours/AddTimeRecordDialog";
import { approveAllForWeek } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import { FileText, Printer, Plus, CheckCheck } from "lucide-react";

type PayrollData = {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  workers: PayrollWorker[];
};

type TimeRecordRow = {
  id: string;
  clockInAt: Date | string;
  clockOutAt: Date | string | null;
  breakMinutes: number;
  totalMinutes: number | null;
  approvalStatus: string;
  notes?: string | null;
  user?: { id: string; name: string };
};

export function PayrollClient({
  initialPayroll,
  timeRecords,
  careWorkers,
  properties,
  weekStartStr,
  weekEndStr,
  useCustomPeriod,
  dateFromParam,
  dateToParam,
  defaultWeekStartStr,
}: {
  initialPayroll: PayrollData;
  timeRecords: TimeRecordRow[];
  careWorkers: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  weekStartStr: string;
  weekEndStr: string;
  useCustomPeriod: boolean;
  dateFromParam: string;
  dateToParam: string;
  defaultWeekStartStr: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [slipPreview, setSlipPreview] = useState<{ userId: string; workerName: string } | null>(null);
  const [addHoursOpen, setAddHoursOpen] = useState(false);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slipIframeRef = useRef<HTMLIFrameElement>(null);

  const pendingCount = timeRecords.filter((r) => r.approvalStatus === "PENDING").length;

  function handleWeekChange(weekDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (weekDate) params.set("week", weekDate);
    else params.delete("week");
    params.delete("dateFrom");
    params.delete("dateTo");
    router.push(`/payroll?${params.toString()}`);
  }

  function handleCustomPeriodChange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("week");
    if (from) params.set("dateFrom", from);
    else params.delete("dateFrom");
    if (to) params.set("dateTo", to);
    else params.delete("dateTo");
    router.push(`/payroll?${params.toString()}`);
  }

  function handleApproveAll() {
    startTransition(async () => {
      try {
        const start = typeof initialPayroll.weekStart === "string" ? new Date(initialPayroll.weekStart) : initialPayroll.weekStart;
        const end = typeof initialPayroll.weekEnd === "string" ? new Date(initialPayroll.weekEnd) : initialPayroll.weekEnd;
        await approveAllForWeek(start, end);
        toast.success("All pending records approved.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to approve all");
      }
    });
  }

  function openSlip(userId: string, workerName: string) {
    setSlipPreview({ userId, workerName });
  }

  function handleSlipPrint() {
    try {
      slipIframeRef.current?.contentWindow?.print();
    } catch {
      // fallback: open in new window for print
      if (slipPreview) {
        const url = `/payroll/slip?userId=${encodeURIComponent(slipPreview.userId)}&weekStart=${weekStartStr}&weekEnd=${weekEndStr}`;
        const w = window.open(url, "_blank", "noopener,noreferrer");
        w?.addEventListener("load", () => w.print());
      }
    }
  }

  const slipUrl =
    slipPreview &&
    `/payroll/slip?userId=${encodeURIComponent(slipPreview.userId)}&weekStart=${weekStartStr}&weekEnd=${weekEndStr}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title">Period</CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Use a standard week (Monday–Sunday) or set a custom start and end date.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payroll-week">Week starting (Monday)</Label>
            <Input
              id="payroll-week"
              type="date"
              key={useCustomPeriod ? "custom" : weekStartStr}
              defaultValue={useCustomPeriod ? defaultWeekStartStr : weekStartStr}
              className="max-w-[200px] min-h-[44px]"
              onChange={(e) => handleWeekChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--muted-foreground)]">Or custom period</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                placeholder="Start"
                className="max-w-[160px] min-h-[44px]"
                value={dateFromParam || undefined}
                onChange={(e) => handleCustomPeriodChange(e.target.value, dateToParam)}
              />
              <span className="text-sm text-[var(--muted-foreground)]">to</span>
              <Input
                type="date"
                placeholder="End"
                className="max-w-[160px] min-h-[44px]"
                value={dateToParam || undefined}
                onChange={(e) => handleCustomPeriodChange(dateFromParam, e.target.value)}
              />
            </div>
          </div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {initialPayroll.weekLabel}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <CardTitle className="section-title">
                Time records for this {useCustomPeriod ? "period" : "week"}
              </CardTitle>
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                Add hours manually or approve pending records. Then use the Care workers table below for slips.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {careWorkers.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 min-h-[36px]"
                  onClick={() => setAddHoursOpen(true)}
                >
                  <Plus className="size-4" />
                  Add hours
                </Button>
              )}
              {pendingCount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 min-h-[36px]"
                  onClick={handleApproveAll}
                  disabled={pending}
                >
                  <CheckCheck className="size-4" />
                  Approve all ({pendingCount})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {timeRecords.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No time records for this period. Add hours above to create manual payroll.
            </p>
          ) : (
            <TimesheetTable records={timeRecords} isAdmin={true} />
          )}
        </CardContent>
      </Card>
      <AddTimeRecordDialog
        open={addHoursOpen}
        onOpenChange={setAddHoursOpen}
        workers={careWorkers}
        properties={properties}
        defaultDate={weekStartStr}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title">Care workers</CardTitle>
          <p className="text-sm font-medium text-[var(--foreground)] mt-1">
            Payroll generated for: {initialPayroll.weekLabel}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Totals use rate cards (Staff edit). Expand a row to see hours and pay by property.
          </p>
        </CardHeader>
        <CardContent>
          {initialPayroll.workers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No care workers or no approved time records for this period. Add hours above and approve them to see totals here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-3 font-medium w-[40px]" />
                    <th className="text-left py-3 font-medium">Name</th>
                    <th className="text-right py-3 font-medium">Hours</th>
                    <th className="text-right py-3 font-medium">Fallback rate</th>
                    <th className="text-right py-3 font-medium">Total pay</th>
                    <th className="w-[100px]" />
                  </tr>
                </thead>
                <tbody>
                  {initialPayroll.workers.map((w) => (
                    <Fragment key={w.userId}>
                      <tr
                        className="border-b border-[var(--border)]/80 hover:bg-[var(--muted)]/30"
                      >
                        <td className="py-2">
                          {(w.propertyBreakdown?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-[var(--muted)]"
                              onClick={() => setExpandedWorker(expandedWorker === w.userId ? null : w.userId)}
                              aria-label={expandedWorker === w.userId ? "Collapse" : "Expand by property"}
                            >
                              {expandedWorker === w.userId ? "−" : "+"}
                            </button>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="font-medium">{w.name}</span>
                        </td>
                        <td className="text-right py-3">
                          {w.totalHours > 0 ? w.totalHours.toFixed(2) : "—"}
                        </td>
                        <td className="text-right py-3">
                          {w.hourlyRate != null
                            ? `£${w.hourlyRate.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="text-right py-3">
                          {w.totalPay != null
                            ? `£${w.totalPay.toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 min-h-[36px]"
                            onClick={() => openSlip(w.userId, w.name)}
                          >
                            <FileText className="size-4" />
                            Slip
                          </Button>
                        </td>
                      </tr>
                      {expandedWorker === w.userId && (w.propertyBreakdown?.length ?? 0) > 0 && (
                        <tr key={`${w.userId}-breakdown`} className="border-b border-[var(--border)]/80 bg-[var(--muted)]/20">
                          <td colSpan={6} className="py-2 px-4">
                            <div className="text-xs font-medium text-[var(--muted-foreground)] mb-1">By property</div>
                            <ul className="space-y-0.5">
                              {(w.propertyBreakdown ?? []).map((p) => (
                                <li key={p.propertyId ?? "none"} className="flex justify-between gap-4">
                                  <span>{p.propertyName ?? "No property"}</span>
                                  <span>{p.hours.toFixed(2)} h → £{p.pay.toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!slipPreview} onOpenChange={(open) => !open && setSlipPreview(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>Salary slip — {slipPreview?.workerName ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-2 overflow-hidden">
            {slipUrl && (
              <iframe
                ref={slipIframeRef}
                src={slipUrl}
                title="Salary slip preview"
                className="w-full h-[78vh] min-h-[500px] border border-[var(--border)] rounded-md bg-white"
              />
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[var(--border)]">
            <Button variant="outline" onClick={() => setSlipPreview(null)}>
              Close
            </Button>
            <Button className="gap-1.5" onClick={handleSlipPrint}>
              <Printer className="size-4" />
              Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
