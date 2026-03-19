"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddTimeRecordDialog } from "./AddTimeRecordDialog";

export function AddHoursBlock({
  workers,
}: {
  workers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 min-h-[36px]"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Add hours
      </Button>
      <AddTimeRecordDialog open={open} onOpenChange={setOpen} workers={workers} />
    </>
  );
}
