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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateJournalEntry } from "@/app/(dashboard)/notes/actions";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "ROUTINE", label: "Routine" },
  { value: "MEDICATION", label: "Medication" },
  { value: "BEHAVIOR", label: "Behavior" },
  { value: "MEAL", label: "Meal" },
  { value: "PERSONAL_CARE", label: "Personal Care" },
  { value: "OTHER", label: "Other" },
] as const;

type Entry = {
  id: string;
  category: string;
  content: string;
};

export function EditJournalEntryDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: Entry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(entry?.category ?? "ROUTINE");
  const [content, setContent] = useState(entry?.content ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (entry) {
      setCategory(entry.category);
      setContent(entry.content);
    }
  }, [entry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    setPending(true);
    try {
      await updateJournalEntry(entry.id, {
        category: category as (typeof CATEGORIES)[number]["value"],
        content: content.trim(),
      });
      toast.success("Note updated");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPending(false);
    }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger id="edit-category" className="min-h-[48px]">
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
          <div className="grid gap-2">
            <Label htmlFor="edit-content">Content</Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              className="text-base resize-none"
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
