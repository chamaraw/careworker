"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { JournalForm } from "./JournalForm";

export function JournalFormWrapper({
  shifts,
}: {
  shifts: { id: string; startAt: Date | string; endAt: Date | string; serviceUser: { name: string } }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        size="lg"
        className="min-h-[48px] gap-2"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-5" />
        Add journal entry
      </Button>
      {open && (
        <JournalForm
          shifts={shifts}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </div>
  );
}
