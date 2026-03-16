"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateTimeRecord } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";

type Record = {
  id: string;
  clockInAt: Date | string;
  clockOutAt: Date | null | string;
  breakMinutes: number;
  notes?: string | null;
};

function toLocalDatetime(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function EditTimeRecordDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Record | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!record) return;
    const inDate = typeof record.clockInAt === "string" ? parseISO(record.clockInAt) : record.clockInAt;
    setClockIn(toLocalDatetime(inDate));
    if (record.clockOutAt) {
      const outDate = typeof record.clockOutAt === "string" ? parseISO(record.clockOutAt) : record.clockOutAt;
      setClockOut(toLocalDatetime(outDate));
    } else {
      setClockOut("");
    }
    setBreakMinutes(record.breakMinutes ?? 0);
    setNotes(record.notes ?? "");
  }, [record]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!record) return;
    setPending(true);
    try {
      await updateTimeRecord(record.id, {
        clockInAt: new Date(clockIn),
        clockOutAt: clockOut ? new Date(clockOut) : undefined,
        breakMinutes,
        notes: notes.trim() || undefined,
      });
      toast.success("Time record updated. It will need approval again.");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPending(false);
    }
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit time record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="clockIn">Clock in</Label>
            <Input
              id="clockIn"
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              required
              className="text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clockOut">Clock out (leave empty if still clocked in)</Label>
            <Input
              id="clockOut"
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="breakMinutes">Break (minutes)</Label>
            <Input
              id="breakMinutes"
              type="number"
              min={0}
              step={5}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
              className="text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-base resize-none"
              placeholder="e.g. Late start due to..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
