import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { getShifts, getCareWorkers, getServiceUsers, getProperties } from "./actions";
import { RosterCalendar } from "@/components/roster/RosterCalendar";

export default async function RosterPage() {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const start = subMonths(startOfMonth(new Date()), 1);
  const end = addMonths(endOfMonth(new Date()), 1);
  const [shifts, careWorkers, serviceUsers, properties] = await Promise.all([
    getShifts(start, end),
    getCareWorkers(),
    getServiceUsers(),
    getProperties(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Roster</h1>
      <p className="text-muted-foreground">
        {isAdmin
          ? "View and manage shifts. Click a date range to add a shift, or drag to reschedule."
          : "Your scheduled shifts."}
      </p>
      <RosterCalendar
        shifts={shifts}
        isAdmin={isAdmin}
        careWorkers={careWorkers}
        serviceUsers={serviceUsers}
        properties={properties}
      />
    </div>
  );
}
