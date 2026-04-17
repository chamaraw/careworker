"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { getShiftContextNotes } from "@/app/(dashboard)/roster/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BookOpen, ListTodo, Stethoscope, AlertCircle, ClipboardList, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type NotesData = Awaited<ReturnType<typeof getShiftContextNotes>>;

export function ShiftContextNotes({ serviceUserId, serviceUserName }: { serviceUserId: string; serviceUserName: string }) {
  const [data, setData] = useState<NotesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getShiftContextNotes(serviceUserId).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [serviceUserId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-sm text-[var(--muted-foreground)]">
        Loading notes…
      </div>
    );
  }

  if (!data) return null;

  const { serviceUser, journalEntries, followUpActions, auditsDueToday } = data;
  const hasAny =
    journalEntries.length > 0 ||
    followUpActions.length > 0 ||
    (auditsDueToday?.length ?? 0) > 0 ||
    serviceUser?.medicalNotes ||
    serviceUser?.allergies;

  if (!hasAny) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-sm text-[var(--muted-foreground)]">
        No recent notes or follow-ups for {serviceUserName}. Good to start the shift.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--foreground)]">
        Notes for {serviceUserName} — continue support
      </h4>

      {(serviceUser?.medicalNotes || serviceUser?.allergies) && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Stethoscope className="size-3.5" />
              Medical & allergies
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-3 pb-2 text-sm space-y-1">
            {serviceUser.allergies && (
              <p><span className="font-medium">Allergies:</span> {serviceUser.allergies}</p>
            )}
            {serviceUser.medicalNotes && (
              <p className="whitespace-pre-wrap"><span className="font-medium">Notes:</span> {serviceUser.medicalNotes}</p>
            )}
          </CardContent>
        </Card>
      )}

      {followUpActions.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <ListTodo className="size-3.5" />
              Follow-up actions ({followUpActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-3 pb-2">
            <ul className="space-y-1.5 text-sm">
              {followUpActions.map((a) => (
                <li key={a.id} className="flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="flex-1">{a.description}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    Due {format(new Date(a.dueDate), "MMM d")}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(auditsDueToday?.length ?? 0) > 0 && (
        <Card className="border-[#005EB8]/20 bg-[#E8F4FC]/30">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-[#005EB8]">
              <ClipboardList className="size-3.5" />
              Audits due today ({auditsDueToday!.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-3 pb-3 space-y-2">
            {auditsDueToday!.slice(0, 8).map((a) => (
              <div key={a.templateId} className="rounded border border-[#005EB8]/15 bg-white px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.templateName}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.haveToday}/{a.neededToday} done today
                  </p>
                </div>
                <Link
                  href={a.openPath}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "min-h-[40px] bg-[#005EB8] hover:bg-[#004a94] text-white shrink-0 inline-flex items-center gap-1.5"
                  )}
                >
                  Open
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ))}
            {auditsDueToday!.length > 8 ? (
              <p className="text-xs text-muted-foreground">
                Showing 8 of {auditsDueToday!.length}. Open Audit recording to see the full list.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {journalEntries.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              Recent notes
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 px-3 pb-2 max-h-40 overflow-y-auto space-y-2 text-sm">
            {journalEntries.slice(0, 8).map((e) => (
              <div key={e.id} className="border-b border-[var(--border)]/60 pb-2 last:border-0 last:pb-0">
                <p className="text-[var(--muted-foreground)] text-xs">
                  {format(new Date(e.recordedAt), "MMM d, HH:mm")} · {e.shift.careWorker.name} · {e.category}
                </p>
                <p className="whitespace-pre-wrap mt-0.5">{e.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
