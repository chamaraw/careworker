"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { clockOut } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import { LiveDateTimeDisplay } from "./LiveDateTimeDisplay";
import { AlertTriangle } from "lucide-react";
import type { WorkerAuditReminderItem } from "@/lib/audit-reminders";

export function ClockOutDialog({
  open,
  onOpenChange,
  pendingAuditReminders = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Incomplete audit tasks for today (same source as dashboard). Shown before clock-out. */
  pendingAuditReminders?: WorkerAuditReminderItem[];
}) {
  const router = useRouter();
  const [clockOutPending, startTransition] = useTransition();

  function handleClockOut() {
    const hadIncompleteAudits = pendingAuditReminders.some((r) => r.haveToday < r.neededToday);
    startTransition(() => {
      clockOut()
        .then(() => {
          toast.success("Clocked out");
          if (hadIncompleteAudits) {
            toast.message(
              "Some of today's audits were still due — hand over or complete when you are next in if your policy allows."
            );
          }
          onOpenChange(false);
          router.refresh();
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Clock out failed");
        });
    });
  }

  const incompleteAudits = pendingAuditReminders.filter((r) => r.haveToday < r.neededToday);
  const showAuditReminder = incompleteAudits.length > 0;
  const preview = incompleteAudits.slice(0, 6);
  const moreCount = incompleteAudits.length - preview.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clock out</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <LiveDateTimeDisplay variant="hero" />
          {showAuditReminder ? (
            <Alert
              className="border-amber-400/90 bg-amber-50 text-amber-950 [&>svg]:text-amber-700"
              role="alert"
            >
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle className="text-amber-950">Audits still due today</AlertTitle>
              <AlertDescription className="text-amber-950/95 space-y-2">
                <p>
                  You have <strong className="font-semibold">{incompleteAudits.length}</strong> audit
                  {incompleteAudits.length === 1 ? "" : "s"} not fully completed for people on your shift today. Finish them
                  before you go if you can, or hand over to the next worker.
                </p>
                <ul className="list-none space-y-2 pt-1">
                  {preview.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-1 rounded-md border border-amber-200/80 bg-white/90 px-2.5 py-2 text-sm text-foreground"
                    >
                      <span className="font-medium leading-snug">
                        {item.templateName} — {item.serviceUserName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.haveToday}/{item.neededToday} done · Shift {item.shiftWindowLabel}
                      </span>
                      <Link
                        href={item.openPath}
                        className="text-sm font-semibold text-[#005EB8] underline-offset-2 hover:underline min-h-[44px] inline-flex items-center touch-manipulation"
                        onClick={() => onOpenChange(false)}
                      >
                        Open form
                      </Link>
                    </li>
                  ))}
                </ul>
                {moreCount > 0 ? (
                  <p className="text-xs text-amber-900/90">And {moreCount} more — see Today&apos;s audits on the Hours page.</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm text-muted-foreground text-center">
            Confirm you are finishing your shift now. Your clock-out time is recorded when you tap Clock out
            {showAuditReminder ? " anyway" : ""}.
          </p>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[52px] w-full sm:w-auto touch-manipulation"
            onClick={() => onOpenChange(false)}
          >
            {showAuditReminder ? "Stay clocked in" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[52px] w-full sm:w-auto text-base font-semibold touch-manipulation"
            disabled={clockOutPending}
            onClick={handleClockOut}
          >
            {clockOutPending ? "Clocking out…" : showAuditReminder ? "Clock out anyway" : "Clock out now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
