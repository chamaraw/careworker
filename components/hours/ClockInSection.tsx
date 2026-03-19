"use client";

import { useState } from "react";
import { ClockButton } from "./ClockButton";
import { BreakButton } from "./BreakButton";
import { ClockInDialog } from "./ClockInDialog";

export function ClockInSection({
  isClockedIn,
  properties,
}: {
  isClockedIn: boolean;
  properties: { id: string; name: string }[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canClockIn = properties.length > 0;

  return (
    <>
      <ClockInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        properties={properties}
      />
      <div className="flex flex-col gap-4">
        <ClockButton
          isClockedIn={isClockedIn}
          whenNotClockedInClick={canClockIn ? () => setDialogOpen(true) : undefined}
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
