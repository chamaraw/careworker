"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import type { WorkerPerformanceRow } from "@/app/(dashboard)/performance/actions";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Aggregate one row per worker (for charts). Uses first row per worker when multiple properties. */
function aggregateByWorker(rows: WorkerPerformanceRow[]): WorkerPerformanceRow[] {
  const byWorker = new Map<string, WorkerPerformanceRow>();
  for (const r of rows) {
    if (!byWorker.has(r.workerId)) byWorker.set(r.workerId, r);
  }
  return Array.from(byWorker.values()).sort(
    (a, b) => (b.performanceIndex ?? 0) - (a.performanceIndex ?? 0)
  );
}

/** Aggregate by property for "across properties" chart. */
function aggregateByVenue(rows: WorkerPerformanceRow[]): { venueId: string; venueName: string; avgScore: number; totalHours: number; workers: number }[] {
  const byVenue = new Map<string, { venueName: string; scores: number[]; hours: number; workerIds: Set<string> }>();
  for (const r of rows) {
    const key = r.propertyId ?? "__none__";
    const venueName = r.propertyName ?? "No property";
    if (!byVenue.has(key)) {
      byVenue.set(key, { venueName, scores: [], hours: 0, workerIds: new Set() });
    }
    const cur = byVenue.get(key)!;
    if (r.performanceIndex != null) cur.scores.push(r.performanceIndex);
    cur.hours += r.approvedHours;
    cur.workerIds.add(r.workerId);
  }
  return Array.from(byVenue.entries())
    .map(([venueId, data]) => ({
      venueId,
      venueName: data.venueName,
      avgScore: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
      totalHours: Math.round(data.hours * 10) / 10,
      workers: data.workerIds.size,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

export function PerformanceCharts({
  rows,
  selectedVenueName = null,
}: {
  rows: WorkerPerformanceRow[];
  selectedVenueName?: string | null;
}) {
  const chartData = aggregateByWorker(rows);
  const venueData = aggregateByVenue(rows);
  const showVenueChart = venueData.length > 1 && !selectedVenueName;

  const venueSubtitle = selectedVenueName ? ` (${selectedVenueName})` : "";

  return (
    <div className="space-y-8">
      {showVenueChart && venueData.length > 0 && (
        <div className="space-y-4">
          <h3 className="section-title">Across properties</h3>
          <p className="body-text-muted text-sm">
            Compare properties. Select a property in the filter above to drill down to workers at that property.
          </p>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h4 className="text-sm font-semibold mb-4">Average performance score by property</h4>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={venueData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 40 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 120]} stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="venueName"
                      width={100}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value) => [value != null && typeof value === "number" ? Math.round(value).toString() : "—", "Avg score"]}
                      labelFormatter={(_, payload) => payload[0]?.payload?.venueName ?? ""}
                    />
                    <Bar dataKey="avgScore" name="Avg score" radius={[0, 4, 4, 0]}>
                      {venueData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                    <ReferenceLine x={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h4 className="text-sm font-semibold mb-4">Total approved hours by property</h4>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={venueData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 40 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="venueName"
                      width={100}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value) => [value != null && typeof value === "number" ? `${value} h` : "—", "Hours"]}
                      labelFormatter={(_, payload) => {
                        const p = payload[0]?.payload;
                        return p ? `${p.venueName} (${p.workers} worker${p.workers !== 1 ? "s" : ""})` : "";
                      }}
                    />
                    <Bar dataKey="totalHours" name="Hours" radius={[0, 4, 4, 0]} fill="var(--chart-3)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {chartData.length === 0 ? null : (
        <div className="space-y-6">
          <h3 className="section-title">
            Worker comparison{venueSubtitle}
          </h3>
          <WorkerChartsSection chartData={chartData} />
        </div>
      )}
    </div>
  );
}

function WorkerChartsSection({ chartData }: { chartData: WorkerPerformanceRow[] }) {
  const performanceData = chartData.map((r) => ({
    name: r.workerName.split(" ")[0] || r.workerName,
    fullName: r.workerName,
    score: r.performanceIndex ?? 0,
    rank: r.rank ?? 0,
  }));

  const hoursData = chartData.map((r) => ({
    name: r.workerName.split(" ")[0] || r.workerName,
    fullName: r.workerName,
    hours: Math.round(r.approvedHours * 10) / 10,
    expected: Math.round(r.expectedHours * 10) / 10,
  }));

  const varianceData = chartData
    .filter((r) => r.timeVariancePct != null)
    .map((r) => ({
      name: r.workerName.split(" ")[0] || r.workerName,
      fullName: r.workerName,
      variance: r.timeVariancePct ?? 0,
    }));

  return (
    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h4 className="text-sm font-semibold mb-4">Performance score vs baseline (100)</h4>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performanceData}
              margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 120]} stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value) => [value != null ? `${value}` : "—", "Score"]}
                labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""}
              />
              <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]} fill="var(--chart-1)">
                {performanceData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
              <ReferenceLine x={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h4 className="text-sm font-semibold mb-4">Approved hours (vs expected)</h4>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={hoursData}
              margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value, name) => [value != null ? `${value} h` : "—", String(name)]}
                labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""}
              />
              <Legend />
              <Bar dataKey="hours" name="Approved hours" radius={[0, 4, 4, 0]} fill="var(--chart-1)" />
              <Bar dataKey="expected" name="Expected hours" radius={[0, 4, 4, 0]} fill="var(--chart-3)" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {varianceData.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 lg:col-span-2">
          <h4 className="text-sm font-semibold mb-4">Time variance from baseline (%)</h4>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={varianceData}
                margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value) => [value != null ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%` : "—", "Variance"]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""}
                />
                <Bar dataKey="variance" name="Variance" radius={[4, 4, 0, 0]}>
                  {varianceData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.variance > 0 ? "var(--chart-4)" : "var(--chart-3)"}
                    />
                  ))}
                </Bar>
                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
