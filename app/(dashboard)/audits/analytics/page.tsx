import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCqcAssessments, getFormSubmissions, getRiskTrends, getWorkforceComplianceData } from "../actions";

export default async function AuditAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const [assessments, submissions, risks, workforce] = await Promise.all([
    getCqcAssessments(),
    getFormSubmissions({ limit: 1000 }),
    getRiskTrends(undefined, 12),
    getWorkforceComplianceData(),
  ]);
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const submissionByMonth = submissions.reduce<Record<string, number>>((acc, s) => {
    const k = monthKey(new Date(s.createdAt));
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const riskByMonth = risks.reduce<Record<string, number>>((acc, r) => {
    const k = monthKey(new Date(r.createdAt));
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const sortedMonths = Array.from(new Set([...Object.keys(submissionByMonth), ...Object.keys(riskByMonth)])).sort();
  const maxSubmissions = Math.max(1, ...Object.values(submissionByMonth));
  const maxRisks = Math.max(1, ...Object.values(riskByMonth));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit analytics</h1>
      <div className="rounded border p-3 text-sm">
        CQC assessments: {assessments.length} · Submissions: {submissions.length} · Risk records (12 months): {risks.length} · Staff: {workforce.users}
      </div>
      <div className="rounded border p-3 space-y-2">
        <div className="text-sm font-medium">Submission trend (monthly)</div>
        {sortedMonths.map((m) => {
          const value = submissionByMonth[m] ?? 0;
          return (
            <div key={`sub-${m}`} className="text-xs">
              <div className="flex justify-between"><span>{m}</span><span>{value}</span></div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-blue-500" style={{ width: `${(value / maxSubmissions) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="rounded border p-3 space-y-2">
        <div className="text-sm font-medium">Risk trend (monthly)</div>
        {sortedMonths.map((m) => {
          const value = riskByMonth[m] ?? 0;
          return (
            <div key={`risk-${m}`} className="text-xs">
              <div className="flex justify-between"><span>{m}</span><span>{value}</span></div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-orange-500" style={{ width: `${(value / maxRisks) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
      <div className="rounded border p-3 text-sm">
        Workforce snapshot: records {workforce.records} · expiring docs {workforce.expiringDocs} · overdue supervisions {workforce.overdueSupervisions}
      </div>
    </div>
  );
}
