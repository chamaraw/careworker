import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { subDays } from "date-fns";
import { getPerformanceStats, getProperties, getCareWorkers } from "./actions";
import {
  BASELINE_MINUTES_PER_TASK,
  BASELINE_MINUTES_PER_SHIFT,
  BASELINE_COMPLETION_RATE,
  BASELINE_INCIDENTS_PER_100H,
  BASELINE_JOURNAL_PER_10H,
} from "@/lib/performance-baseline";
import { PerformanceFilters } from "@/components/performance/PerformanceFilters";
import { PerformanceTable } from "@/components/performance/PerformanceTable";
import { PerformanceCharts } from "@/components/performance/PerformanceCharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ worker?: string; property?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const params = await searchParams;
  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : subDays(new Date(), 30);
  const dateTo = params.dateTo ? new Date(params.dateTo) : new Date();
  const workerId = params.worker || undefined;
  const propertyId = params.property || undefined;

  const [stats, properties, workers] = await Promise.all([
    getPerformanceStats({
      workerId,
      propertyId,
      dateFrom,
      dateTo,
    }),
    getProperties(),
    getCareWorkers(),
  ]);

  const selectedVenueName = propertyId
    ? (properties.find((p) => p.id === propertyId)?.name ?? undefined)
    : undefined;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="page-title">Care worker performance</h1>
        <p className="body-text-muted mt-1">
          Compare workers against a national-average baseline. Rank and score show who is performing
          better; time variance shows hours vs expected (by care need).
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <PerformanceFilters
            workers={workers}
            properties={properties}
            defaultWorkerId={workerId}
            defaultPropertyId={propertyId}
            defaultDateFrom={dateFrom.toISOString().slice(0, 10)}
            defaultDateTo={dateTo.toISOString().slice(0, 10)}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title">Worker comparison</CardTitle>
          <p className="body-text-muted text-sm mt-1">
            Performance score, hours vs expected, and time variance across workers.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <PerformanceCharts rows={stats} selectedVenueName={selectedVenueName} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title">Benchmark baseline (national average)</CardTitle>
          <p className="body-text-muted text-sm mt-1">
            Task baselines (expected min per task): chore = {BASELINE_MINUTES_PER_TASK.chore} min, medicine ={" "}
            {BASELINE_MINUTES_PER_TASK.medicine} min, bath = {BASELINE_MINUTES_PER_TASK.bath} min, personal care ={" "}
            {BASELINE_MINUTES_PER_TASK.personal_care} min, meal support = {BASELINE_MINUTES_PER_TASK.meal_support} min.
            Shift expectation is derived from care need (typical task mix): low = {BASELINE_MINUTES_PER_SHIFT.low} min, medium ={" "}
            {BASELINE_MINUTES_PER_SHIFT.medium} min, high = {BASELINE_MINUTES_PER_SHIFT.high} min.
            Target completion = {(BASELINE_COMPLETION_RATE * 100).toFixed(0)}%. Baseline incidents ={" "}
            {BASELINE_INCIDENTS_PER_100H} per 100 h, journal = {BASELINE_JOURNAL_PER_10H} per 10 h. Score 100 = at baseline; higher is better.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <PerformanceTable rows={stats} />
        </CardContent>
      </Card>
    </div>
  );
}
