import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAuditDashboardData } from "./actions";

export default async function AuditsDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");

  const data = await getAuditDashboardData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audits</h1>
        <p className="text-muted-foreground">Audit management, risk, compliance, workforce, and CQC tracking.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Open actions</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.openActions}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Overdue actions</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.overdueActions}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Properties</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.properties.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Incident-linked actions</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{data.linkedIncidentActions}</CardContent></Card>
      </div>

      <Card className="border-[#005EB8]/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#005EB8]">Manager monitoring</CardTitle>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Jump to any audits area. <strong className="text-foreground">Audit manager</strong> combines property
            compliance, upcoming filings, and <strong className="text-foreground">staff clock in/out</strong> (same
            data as Hours).
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/audits/manager"
              className="rounded-lg border border-[#005EB8]/25 bg-[#E8F4FC]/40 px-3 py-2.5 text-sm font-semibold text-[#005EB8] hover:bg-[#E8F4FC] min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Audit manager (properties + clocks)
            </Link>
            <Link
              href="/audits/recording"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Audit recording (staff filing)
            </Link>
            <Link
              href="/payroll"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Payroll &amp; timesheets (admin)
            </Link>
            <Link
              href="/audits/templates"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Form templates
            </Link>
            <Link
              href="/audits/care-packages"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Care packages
            </Link>
            <Link
              href="/audits/actions"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Follow-up actions
            </Link>
            <Link
              href="/audits/risks"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Risk register
            </Link>
            <Link
              href="/audits/compliance"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Compliance documents
            </Link>
            <Link
              href="/audits/workforce"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Workforce &amp; competency
            </Link>
            <Link
              href="/audits/analytics"
              className="rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-muted/50 min-h-[44px] flex items-center touch-manipulation text-center sm:text-left leading-snug"
            >
              Analytics
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Property overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.properties.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  submissions {p._count.auditFormSubmissions} · actions {p._count.auditActions} · risks {p._count.riskEntries}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{p.cqcAssessments[0]?.overallRating ?? "No rating"}</Badge>
                <Link href={`/audits/property/${p.id}`} className="underline text-sm">Open</Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
