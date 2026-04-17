import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStaff } from "./actions";
import { getTrainingMatrix } from "@/app/(dashboard)/audits/actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StaffForm } from "./StaffForm";

function competencyGapsFromMatrix(
  rows: Array<{ userId: string; cells: Array<{ applicable: boolean; status: string }> }>
) {
  const map = new Map<string, { expired: number; expiring: number; missing: number }>();
  for (const row of rows) {
    let expired = 0;
    let expiring = 0;
    let missing = 0;
    for (const c of row.cells) {
      if (!c.applicable) continue;
      if (c.status === "EXPIRED") expired += 1;
      else if (c.status === "EXPIRING") expiring += 1;
      else if (c.status === "MISSING") missing += 1;
    }
    map.set(row.userId, { expired, expiring, missing });
  }
  return map;
}

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");
  const [staff, matrix] = await Promise.all([getStaff(), getTrainingMatrix()]);
  const gapsByUser = competencyGapsFromMatrix(matrix.rows);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <p className="text-muted-foreground">
        Care worker management. Add, edit, or deactivate staff. Competency profiles and training matrix:{" "}
        <Link href="/audits/workforce" className="underline text-[#005EB8] font-medium">
          Workforce compliance
        </Link>
        .
      </p>
      <StaffForm />
      <div className="grid gap-4 md:grid-cols-2">
        {staff.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Avatar className="size-12">
                <AvatarFallback>
                  {s.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg">{s.name}</CardTitle>
                <p className="text-sm text-muted-foreground truncate">{s.email}</p>
                {!s.active && (
                  <Badge variant="destructive" className="mt-1">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(() => {
                const g = gapsByUser.get(s.id);
                if (!g || (g.expired === 0 && g.expiring === 0 && g.missing === 0)) {
                  return s.active ? (
                    <p className="text-xs text-[#007F3B] font-medium">Training: no gaps on matrix</p>
                  ) : null;
                }
                return (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold text-[#005EB8]">Training:</span>{" "}
                    {g.expired > 0 ? (
                      <span className="text-red-800 font-medium">{g.expired} expired</span>
                    ) : null}
                    {g.expired > 0 && (g.expiring > 0 || g.missing > 0) ? " · " : null}
                    {g.expiring > 0 ? (
                      <span className="text-amber-900 font-medium">{g.expiring} due ≤60d</span>
                    ) : null}
                    {g.expiring > 0 && g.missing > 0 ? " · " : null}
                    {g.missing > 0 ? (
                      <span className="text-red-800 font-medium">{g.missing} missing</span>
                    ) : null}
                    .{" "}
                    <Link href="/audits/workforce" className="underline text-[#005EB8]">
                      Matrix
                    </Link>
                  </p>
                );
              })()}
              {s.phone && <p>Phone: {s.phone}</p>}
              {s.qualifications && <p>Qualifications: {s.qualifications}</p>}
              <p className="text-muted-foreground">
                Shifts assigned: {s._count.shiftsAsWorker}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Link href={`/staff/${s.id}/edit`}>
                  <Button variant="outline" size="sm" className="min-h-[40px]">
                    Edit
                  </Button>
                </Link>
                <Link href={`/staff/${s.id}/edit#competency`}>
                  <Button variant="secondary" size="sm" className="min-h-[40px]">
                    Competency
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {staff.length === 0 && (
        <p className="text-muted-foreground py-4">No care workers yet.</p>
      )}
    </div>
  );
}
