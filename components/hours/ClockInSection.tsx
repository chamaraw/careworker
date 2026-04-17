"use client";

import { useState } from "react";
import { ClockButton } from "./ClockButton";
import { BreakButton } from "./BreakButton";
import { ClockInDialog } from "./ClockInDialog";
import { ClockOutDialog } from "./ClockOutDialog";
import type { WorkerAuditReminderItem } from "@/lib/audit-reminders";
import type { ClockInEligibilityPayload } from "@/app/(dashboard)/hours/actions";

export function ClockInSection({
  isClockedIn,
  clockEligibility,
  auditReminders = [],
}: {
  isClockedIn: boolean;
  clockEligibility: ClockInEligibilityPayload | null;
  auditReminders?: WorkerAuditReminderItem[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const canClockIn = !!clockEligibility && clockEligibility.allProperties.length > 0;

  return (
    <>
      <ClockInDialog open={dialogOpen} onOpenChange={setDialogOpen} eligibility={clockEligibility} />
      <ClockOutDialog
        open={clockOutOpen}
        onOpenChange={setClockOutOpen}
        pendingAuditReminders={auditReminders}
      />
      <div className="flex flex-col gap-4">
        <ClockButton
          isClockedIn={isClockedIn}
          whenNotClockedInClick={canClockIn ? () => setDialogOpen(true) : undefined}
          whenClockedInClick={isClockedIn ? () => setClockOutOpen(true) : undefined}
          disabled={!isClockedIn && !canClockIn}
        />
        {!canClockIn && !isClockedIn && (
          <p className="text-sm text-amber-600">
            No properties configured. Contact your manager to clock in.
          </p>
        )}
        {isClockedIn && <BreakButton />}
      </div>
    </>
  );
}
