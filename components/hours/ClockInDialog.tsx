"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clockIn } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import type { ShiftType } from "@prisma/client";

const SHIFT_TYPE_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "LONE_WORKING", label: "Lone working" },
  { value: "SLEEP_NIGHT", label: "Sleep night" },
];

export function ClockInDialog({
  open,
  onOpenChange,
  properties,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("STANDARD");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId.trim()) {
      toast.error("Please select a property.");
      return;
    }
    startTransition(() => {
      clockIn(propertyId, shiftType)
        .then(() => {
          toast.success("Clocked in");
          onOpenChange(false);
          setPropertyId("");
          setShiftType("STANDARD");
          router.refresh();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Clock in failed");
        });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clock in</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="clockin-property">Property *</Label>
            <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")} required>
              <SelectTrigger id="clockin-property">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clockin-shiftType">Shift type</Label>
            <Select
              value={shiftType}
              onValueChange={(v) => setShiftType(v as ShiftType)}
            >
              <SelectTrigger id="clockin-shiftType">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !propertyId.trim()}>
              {pending ? "Clocking in…" : "Clock in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
