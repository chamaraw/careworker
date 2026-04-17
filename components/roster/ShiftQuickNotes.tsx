"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateShift } from "@/app/(dashboard)/roster/actions";
import { toast } from "sonner";
import { PenLine } from "lucide-react";

/**
 * Large, touch- and Apple Pencil–friendly notes field for shift events.
 * Uses native textarea (no canvas) so iOS/iPadOS handwriting & Scribble work in supported apps.
 */
export function ShiftQuickNotes({
  shiftId,
  initialNotes,
  readOnly,
}: {
  shiftId: string;
  initialNotes: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(() => {
      updateShift(shiftId, { notes: notes.trim() === "" ? null : notes.trim() })
        .then(() => {
          toast.success("Notes saved");
          router.refresh();
        })
        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not save notes"));
    });
  }

  if (readOnly) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-sm whitespace-pre-wrap">
        {initialNotes || "No notes."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`shift-notes-${shiftId}`} className="flex items-center gap-2 text-base font-semibold">
        <PenLine className="size-4 shrink-0 text-[#005EB8]" aria-hidden />
        Quick notes
      </Label>
      <p className="text-xs text-muted-foreground">
        Type or use your Apple Pencil / handwriting in the box (iPad). Saves to this shift for the team.
      </p>
      <Textarea
        id={`shift-notes-${shiftId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Tap to write a quick handover or visit note…"
        autoComplete="off"
        autoCorrect="on"
        spellCheck
        inputMode="text"
        className="min-h-[200px] sm:min-h-[220px] text-lg leading-relaxed touch-pan-y touch-manipulation resize-y p-4 input-text-base border-2 border-sky-200/80 focus-visible:border-[#005EB8] dark:border-sky-800/60"
        style={{ WebkitTapHighlightColor: "transparent" as const }}
      />
      <Button
        type="button"
        size="lg"
        className="min-h-[48px] w-full sm:w-auto bg-[#005EB8] hover:bg-[#004a94]"
        disabled={pending}
        onClick={save}
      >
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}
