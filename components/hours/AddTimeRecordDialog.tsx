"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTimeRecordManual,
  getShiftPropertyForWorkerDate,
} from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import type { ShiftType } from "@prisma/client";

const SHIFT_TYPE_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "LONE_WORKING", label: "Lone working" },
  { value: "SLEEP_NIGHT", label: "Sleep night" },
];

export function AddTimeRecordDialog({
  open,
  onOpenChange,
  workers: workersList,
  properties: propertiesList = [],
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: { id: string; name: string }[];
  properties?: { id: string; name: string }[];
  defaultDate?: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("STANDARD");
  const [clockInTime, setClockInTime] = useState("09:00");
  const [clockOutTime, setClockOutTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open && defaultDate) setDate(defaultDate);
  }, [open, defaultDate]);

  useEffect(() => {
    if (!open || !userId || !date) return;
    getShiftPropertyForWorkerDate(userId, date).then(({ propertyId: pid }) => {
      if (pid) setPropertyId(pid);
    });
  }, [open, userId, date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !date || !clockInTime || !clockOutTime) {
      toast.error("Please fill worker, date, and times");
      return;
    }
    const clockInAt = new Date(`${date}T${clockInTime}`);
    const clockOutAt = new Date(`${date}T${clockOutTime}`);
    if (clockOutAt <= clockInAt) {
      toast.error("Clock out must be after clock in");
      return;
    }
    setPending(true);
    try {
      const pid = propertyId.trim();
      if (propertiesList.length > 0 && !pid) {
        toast.error("Please select a property.");
        return;
      }
      if (!pid) {
        toast.error("Property is required. No properties configured—add a property first.");
        return;
      }
      await createTimeRecordManual({
        userId,
        clockInAt,
        clockOutAt,
        breakMinutes,
        notes: notes.trim() || undefined,
        propertyId: pid,
        shiftType,
      });
      toast.success("Hours added. Approve the record in the table below.");
      onOpenChange(false);
      setUserId("");
      setDate("");
      setPropertyId("");
      setShiftType("STANDARD");
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add hours");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add hours manually</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-worker">Worker</Label>
            <Select value={userId} onValueChange={(v) => setUserId(v ?? "")} required>
              <SelectTrigger id="add-worker" className="text-base">
                <SelectValue placeholder="Select worker">
                  {workersList.find((w) => w.id === userId)?.name ?? ""}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {workersList.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-date">Date</Label>
            <Input
              id="add-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="text-base"
            />
          </div>
          {propertiesList.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="add-property">Property *</Label>
              <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")} required>
                <SelectTrigger id="add-property" className="text-base">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {propertiesList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--muted-foreground)]">
                Auto-filled from roster if worker has a shift on this date.
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-shiftType">Shift type</Label>
            <Select
              value={shiftType}
              onValueChange={(v) => setShiftType(v as ShiftType)}
            >
              <SelectTrigger id="add-shiftType" className="text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-clockIn">Clock in</Label>
              <Input
                id="add-clockIn"
                type="time"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-clockOut">Clock out</Label>
              <Input
                id="add-clockOut"
                type="time"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                required
                className="text-base"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-break">Break (minutes)</Label>
            <Input
              id="add-break"
              type="number"
              min={0}
              step={5}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
              className="text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-notes">Notes (optional)</Label>
            <Textarea
              id="add-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-base resize-none"
              placeholder="e.g. Manual entry for missed clock"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add hours"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
