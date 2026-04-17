"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { UkBankHoliday } from "@/lib/uk-bank-holidays";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createCalendarNote } from "./actions";

type Note = {
  id: string;
  date: string | Date;
  content: string;
  user: { name: string };
  createdAt: string | Date;
};

export function CalendarNotesView({
  initialMonth,
  notes,
  ukPublicHolidays = [],
  prevMonth,
  nextMonth,
}: {
  initialMonth: Date;
  notes: Note[];
  /** UK public holidays for the visible month (all nations merged). */
  ukPublicHolidays?: UkBankHoliday[];
  prevMonth: Date;
  nextMonth: Date;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newContent, setNewContent] = useState("");
  const [pending, setPending] = useState(false);

  const notesByDate = notes.reduce<Record<string, Note[]>>((acc, n) => {
    const d = typeof n.date === "string" ? n.date.slice(0, 10) : format(new Date(n.date), "yyyy-MM-dd");
    if (!acc[d]) acc[d] = [];
    acc[d].push(n);
    return acc;
  }, {});

  async function handleAddNote() {
    if (!selectedDate || !newContent.trim()) return;
    setPending(true);
    try {
      await createCalendarNote(selectedDate, newContent.trim());
      setNewContent("");
      setSelectedDate(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const holidayDates = ukPublicHolidays.map((h) => parseISO(h.dateKey));
  const holidayNameByKey = new Map(ukPublicHolidays.map((h) => [h.dateKey, h.name]));

  const modifiers = {
    hasNote: Object.keys(notesByDate).map((d) => parseISO(d)),
    ukPublicHoliday: holidayDates,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">{format(initialMonth, "MMMM yyyy")}</CardTitle>
          <div className="flex gap-2">
            <Link href={`/calendar?month=${format(prevMonth, "yyyy-MM")}`}>
              <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px]">Prev</Button>
            </Link>
            <Link href={`/calendar?month=${format(nextMonth, "yyyy-MM")}`}>
              <Button variant="outline" size="sm" className="min-h-[44px] min-w-[44px]">Next</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-3">
          <p className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm bg-amber-200 border border-amber-400/80" />
              UK public holiday
            </span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-3 rounded-sm bg-primary/10 border border-primary/20" />
              Has note
            </span>
          </p>
          <Calendar
            mode="single"
            required={false}
            selected={selectedDate ?? undefined}
            onSelect={(d) => setSelectedDate(d ?? null)}
            month={initialMonth}
            modifiers={modifiers}
            modifiersClassNames={{
              hasNote: "bg-primary/10 font-semibold",
              ukPublicHoliday:
                "bg-amber-100 dark:bg-amber-950/40 font-semibold ring-1 ring-amber-400/60 ring-inset",
            }}
            className="rounded-lg border w-full max-w-full [--cell-size:2.75rem] p-3"
            classNames={{
              caption_label: "text-base sm:text-lg font-semibold",
              weekday: "text-xs sm:text-sm font-medium text-muted-foreground",
            }}
          />
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate
              ? `Notes for ${format(selectedDate, "PPP")}`
              : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDate && (
            <>
              {(() => {
                const key = format(selectedDate, "yyyy-MM-dd");
                const holidayName = holidayNameByKey.get(key);
                if (!holidayName) return null;
                return (
                  <div className="rounded-md border border-amber-300/80 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm">
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      UK public holiday
                    </span>
                    <p className="text-amber-900/90 dark:text-amber-100/90 mt-0.5">{holidayName}</p>
                  </div>
                );
              })()}
              <div className="space-y-2">
                <label className="text-sm font-medium">Add note</label>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Note for this day…"
                  className="min-h-[100px]"
                />
                <Button
                  size="lg"
                  className="min-h-[48px]"
                  onClick={handleAddNote}
                  disabled={pending || !newContent.trim()}
                >
                  {pending ? "Saving…" : "Save note"}
                </Button>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Existing notes</h3>
                {(() => {
                  const key = format(selectedDate, "yyyy-MM-dd");
                  const dayNotes = notesByDate[key] ?? [];
                  if (dayNotes.length === 0)
                    return <p className="text-muted-foreground text-sm">No notes.</p>;
                  return (
                    <ul className="space-y-2">
                      {dayNotes.map((n) => (
                        <li key={n.id} className="text-sm p-2 bg-muted rounded">
                          <p className="font-medium">{n.user.name}</p>
                          <p className="whitespace-pre-wrap">{n.content}</p>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
