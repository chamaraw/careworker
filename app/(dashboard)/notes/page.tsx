import { auth } from "@/lib/auth";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { getJournalEntries, getShiftsForJournal } from "./actions";
import { JournalTimeline } from "@/components/journal/JournalTimeline";
import { JournalFilters } from "@/components/journal/JournalFilters";
import { JournalFormWrapper } from "@/components/journal/JournalFormWrapper";
import { prisma } from "@/lib/prisma";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; worker?: string; serviceUser?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const params = await searchParams;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : subDays(startOfDay(new Date()), 7);
  const dateTo = params.dateTo ? new Date(params.dateTo) : endOfDay(new Date());
  const careWorkerId = params.worker || undefined;
  const serviceUserId = params.serviceUser || undefined;

  const [entries, shiftsForForm, careWorkers, serviceUsers] = await Promise.all([
    getJournalEntries({
      dateFrom,
      dateTo,
      careWorkerId,
      serviceUserId,
    }),
    getShiftsForJournal(dateFrom, dateTo),
    isAdmin ? prisma.user.findMany({ where: { role: "CARE_WORKER", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    prisma.serviceUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Notes</h1>
      <p className="text-muted-foreground">
        Timestamped care notes. Add entries linked to your shifts.
      </p>
      <JournalFilters
        careWorkers={careWorkers}
        serviceUsers={serviceUsers}
        isAdmin={isAdmin}
        defaultDateFrom={dateFrom.toISOString().slice(0, 10)}
        defaultDateTo={dateTo.toISOString().slice(0, 10)}
      />
      {shiftsForForm.length > 0 ? (
        <JournalFormWrapper shifts={shiftsForForm} />
      ) : (
        <p className="text-muted-foreground text-sm">No shifts in this period to add entries to.</p>
      )}
      <JournalTimeline entries={entries} currentUserId={session.user.id} />
    </div>
  );
}
