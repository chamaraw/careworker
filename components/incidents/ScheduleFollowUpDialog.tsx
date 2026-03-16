"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFollowUpAction } from "@/app/(dashboard)/follow-ups/actions";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";

export function ScheduleFollowUpDialog({
  open,
  onOpenChange,
  serviceUserId,
  serviceUserName,
  incidentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceUserId: string;
  serviceUserName: string;
  incidentId?: string | null;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError("Please enter a description.");
      return;
    }
    const d = dueDate ? new Date(dueDate) : new Date();
    if (isNaN(d.getTime())) {
      setError("Please enter a valid date.");
      return;
    }
    setPending(true);
    try {
      await createFollowUpAction({
        serviceUserId,
        description: description.trim(),
        dueDate: d,
        incidentId: incidentId ?? null,
      });
      setDescription("");
      setDueDate("");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create follow-up.");
    } finally {
      setPending(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--muted-foreground)]">
          For {serviceUserName}. This will appear in shift notes and on the Follow-ups page.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="followup-desc">What needs to be done?</Label>
            <Input
              id="followup-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Review medication, check wound"
              className="min-h-[44px]"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followup-due">Due date</Label>
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-[var(--muted-foreground)]" />
              <Input
                id="followup-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={today}
                className="min-h-[44px]"
                disabled={pending}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Schedule follow-up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
