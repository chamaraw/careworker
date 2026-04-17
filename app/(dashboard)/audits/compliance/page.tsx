import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getComplianceDashboardData, getComplianceDocs } from "../actions";
import { ComplianceClient } from "./compliance-client";

export default async function ComplianceDocsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const [docs, dashboard] = await Promise.all([getComplianceDocs({}), getComplianceDashboardData()]);
  const docRows = docs as { id: string; title: string; category: string; expiresAt: Date | null; readReceipts: { id: string }[] }[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Business compliance</h1>
      <div className="rounded border p-3 text-sm">
        Total docs: {dashboard.total} · Expiring in 60 days: {dashboard.expiring} · Read rate: {dashboard.readRate}%
      </div>
      <ComplianceClient
        initial={docRows.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          expiresAt: d.expiresAt?.toISOString() ?? null,
          readCount: d.readReceipts.length,
        }))}
      />
    </div>
  );
}
