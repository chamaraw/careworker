import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { getShifts, getCareWorkers, getServiceUsers, getProperties } from "./actions";
import { RosterCalendar } from "@/components/roster/RosterCalendar";
import { RosterFilterBar } from "@/components/roster/RosterFilterBar";
import { Suspense } from "react";

function parseCsv(param: string | undefined | null): string[] {
  if (!param?.trim()) return [];
  return param
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.length > 0 && id.length < 48);
}

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    properties?: string;
    staff?: string;
    serviceUsers?: string;
    colorBy?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const params = await searchParams;
  const legacyProperty = params.property?.trim();
  const fromMulti = parseCsv(params.properties);
  const propertyIds =
    fromMulti.length > 0
      ? fromMulti
      : legacyProperty && legacyProperty !== "all"
        ? [legacyProperty]
        : [];

  const filters = {
    propertyIds,
    careWorkerIds: parseCsv(params.staff),
    serviceUserIds: parseCsv(params.serviceUsers),
  };

  const colorBy: "property" | "staff" | "status" =
    params.colorBy === "property"
      ? "property"
      : params.colorBy === "staff" && isAdmin
        ? "staff"
        : "status";

  const start = subMonths(startOfMonth(new Date()), 1);
  const end = addMonths(endOfMonth(new Date()), 1);
  const [shifts, careWorkers, serviceUsers, properties] = await Promise.all([
    getShifts(start, end, filters),
    getCareWorkers(),
    getServiceUsers(),
    getProperties(),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Roster</h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm sm:text-base leading-relaxed">
          {isAdmin
            ? "Plan across properties, staff, and service users. Use filters to narrow the board, then drag or resize shifts in week or day view — or open list view for a compact agenda."
            : "Your scheduled shifts. Use filters to focus on properties or service users."}
        </p>
      </div>

      <Suspense fallback={<div className="h-24 rounded-2xl bg-[#E8F4FC]/50 animate-pulse" aria-hidden />}>
        <RosterFilterBar
          properties={properties}
          careWorkers={careWorkers}
          serviceUsers={serviceUsers}
          isAdmin={isAdmin}
        />
      </Suspense>

      <RosterCalendar
        shifts={shifts}
        isAdmin={isAdmin}
        currentUserId={session.user.id}
        careWorkers={careWorkers}
        serviceUsers={serviceUsers}
        properties={properties}
        colorBy={colorBy}
      />
    </div>
  );
}
