"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createJournalEntry } from "@/app/(dashboard)/journal/actions";

const CATEGORIES = [
  { value: "ROUTINE", label: "Routine" },
  { value: "MEDICATION", label: "Medication" },
  { value: "BEHAVIOR", label: "Behavior" },
  { value: "MEAL", label: "Meal" },
  { value: "PERSONAL_CARE", label: "Personal Care" },
  { value: "OTHER", label: "Other" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
      {pending ? "Saving…" : "Save entry"}
    </Button>
  );
}

export function JournalForm({
  shifts,
  onClose,
  onSuccess,
}: {
  shifts: { id: string; startAt: Date | string; endAt: Date | string; serviceUser: { name: string } }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [shiftId, setShiftId] = useState("");
  const [category, setCategory] = useState<string>("ROUTINE");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!shiftId || !content.trim()) {
      setError("Select a shift and enter content.");
      return;
    }
    try {
      await createJournalEntry({
        shiftId,
        category: category as "ROUTINE" | "MEDICATION" | "BEHAVIOR" | "MEAL" | "PERSONAL_CARE" | "OTHER",
        content: content.trim(),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label>Shift</Label>
            <Select value={shiftId} onValueChange={(v) => v && setShiftId(v)} required>
              <SelectTrigger className="min-h-[48px]">
                {shiftId ? (
                  <span className="truncate">
                    {(() => {
                      const s = shifts.find((x) => x.id === shiftId);
                      return s ? `${s.serviceUser.name} — ${s.startAt instanceof Date ? s.startAt.toLocaleString() : new Date(s.startAt).toLocaleString()}` : shiftId;
                    })()}
                  </span>
                ) : (
                  <SelectValue placeholder="Select shift…" />
                )}
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.serviceUser.name} — {s.startAt instanceof Date ? s.startAt.toLocaleString() : new Date(s.startAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="min-h-[48px]">
                {category ? (
                  <span className="truncate">{CATEGORIES.find((c) => c.value === category)?.label ?? category}</span>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What happened? What support did you provide?"
              className="min-h-[120px] text-base"
              required
            />
          </div>
          <div className="flex gap-2">
            <SubmitButton />
            <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
