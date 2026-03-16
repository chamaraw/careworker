import { auth } from "@/lib/auth";
import { getIncidents, getIncidentStats } from "./actions";
import { IncidentCard } from "@/components/incidents/IncidentCard";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/dashboard/StatCard";
import { AlertTriangle } from "lucide-react";
import { IncidentsPageClient } from "./IncidentsPageClient";

export default async function IncidentsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const [incidents, stats, serviceUsers] = await Promise.all([
    getIncidents({}),
    getIncidentStats(),
    prisma.serviceUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Incidents</h1>
      <p className="text-muted-foreground">
        Report and track incidents. All actions are recorded with timestamps.
      </p>
      {isAdmin && stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard title="Open incidents" value={stats.open} icon={AlertTriangle} />
        </div>
      )}
      <IncidentsPageClient serviceUsers={serviceUsers}>
        <div className="flex flex-col gap-4">
          {incidents.length === 0 ? (
            <p className="text-muted-foreground py-4">No incidents reported.</p>
          ) : (
            incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} isAdmin={isAdmin} />
            ))
          )}
        </div>
      </IncidentsPageClient>
    </div>
  );
}
