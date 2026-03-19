import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { getShifts, getCareWorkers, getServiceUsers, getProperties } from "./actions";
import { RosterCalendar } from "@/components/roster/RosterCalendar";
import { RosterPropertyFilter } from "@/components/roster/RosterPropertyFilter";
import { Suspense } from "react";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const params = await searchParams;
  const propertyId = params.property && params.property.trim() ? params.property.trim() : null;
  const start = subMonths(startOfMonth(new Date()), 1);
  const end = addMonths(endOfMonth(new Date()), 1);
  const [shifts, careWorkers, serviceUsers, properties] = await Promise.all([
    getShifts(start, end, undefined, propertyId),
    getCareWorkers(),
    getServiceUsers(),
    getProperties(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roster</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "View and manage shifts by property. Click a date range to add a shift, or drag to reschedule."
              : "Your scheduled shifts. Choose a property to drill down."}
          </p>
        </div>
        <Suspense fallback={null}>
          <RosterPropertyFilter properties={properties} isAdmin={isAdmin} />
        </Suspense>
      </div>
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
