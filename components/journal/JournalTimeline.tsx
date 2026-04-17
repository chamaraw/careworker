"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { deleteJournalEntry } from "@/app/(dashboard)/notes/actions";
import { toast } from "sonner";
import { EditJournalEntryDialog } from "./EditJournalEntryDialog";

type Entry = {
  id: string;
  category: string;
  content: string;
  recordedAt: Date | string;
  shift: { serviceUser: { name: string } };
  careWorker: { id: string; name: string };
};

export function JournalTimeline({
  entries,
  currentUserId,
}: {
  entries: Entry[];
  currentUserId?: string | null;
}) {
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleEdit(entry: Entry) {
    setEditEntry(entry);
    setEditOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteJournalEntry(id);
        toast.success("Journal entry deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (entries.length === 0) {
    return (
      <p className="body-text-muted py-8 text-center">
        No notes match your filters.
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {entries.map((entry) => {
          const canEdit = currentUserId && entry.careWorker.id === currentUserId;
          return (
            <li key={entry.id}>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{entry.category}</Badge>
                      <span className="text-sm text-[var(--muted-foreground)]">
                        {format(
                          entry.recordedAt instanceof Date ? entry.recordedAt : new Date(entry.recordedAt),
                          "MMM d, yyyy · HH:mm"
                        )}
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleEdit(entry)}
                          className="min-h-[36px]"
                        >
                          <Pencil className="size-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleDelete(entry.id)}
                          className="min-h-[36px] text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm text-[var(--muted-foreground)]">
                    {entry.shift.serviceUser.name} — {entry.careWorker.name}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap body-text">{entry.content}</p>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      <EditJournalEntryDialog entry={editEntry} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
