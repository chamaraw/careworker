import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getServiceUserDetail } from "../actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

export default async function ServiceUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const user = await getServiceUserDetail(id);
  if (!user) notFound();
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/service-users">
          <Button variant="ghost" size="lg" className="min-h-[48px]">
            Back
          </Button>
        </Link>
        {isAdmin && (
          <Link href={`/service-users/${id}/edit`}>
            <Button size="lg" className="min-h-[48px]">
              Edit
            </Button>
          </Link>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-2xl">
              {user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">{user.name}</CardTitle>
            {user.dateOfBirth && (
              <p className="text-muted-foreground">
                DOB: {format(user.dateOfBirth, "PPP")}
              </p>
            )}
            {user.careNeedsLevel && (
              <p className="text-sm text-muted-foreground">
                Care needs: {user.careNeedsLevel}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">Address</h3>
            <p className="text-muted-foreground">{user.address || "—"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Allergies</h3>
            <p className="text-muted-foreground">{user.allergies || "—"}</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <h3 className="font-semibold">Medical notes</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {user.medicalNotes || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Emergency contact</h3>
            <p className="text-muted-foreground">
              {user.emergencyContactName || "—"}
              {user.emergencyContactPhone && ` · ${user.emergencyContactPhone}`}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Care plans</CardTitle>
          <Link href={`/care-plans?serviceUser=${user.id}`}>
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.carePlans.length === 0 ? (
            <p className="text-muted-foreground">No care plans.</p>
          ) : (
            <ul className="space-y-2">
              {user.carePlans.map((p) => (
                <li key={p.id}>
                  <Link href={`/care-plans/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-muted-foreground text-sm ml-2">
                    {p.status} · Review {p.reviewDate ? format(p.reviewDate, "P") : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent incidents</CardTitle>
          <Link href="/incidents">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.incidentReports.length === 0 ? (
            <p className="text-muted-foreground">No incidents.</p>
          ) : (
            <ul className="space-y-2">
              {user.incidentReports.map((i) => (
                <li key={i.id} className="text-sm">
                  <span className="font-medium">{i.severity}</span> — {format(i.occurredAt, "PP")} — {i.careWorker.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent shifts</CardTitle>
          <Link href="/roster">
            <Button variant="ghost" size="sm">View roster</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.shifts.length === 0 ? (
            <p className="text-muted-foreground">No shifts.</p>
          ) : (
            <ul className="space-y-2">
              {user.shifts.map((s) => (
                <li key={s.id} className="text-sm">
                  {format(s.startAt, "PPp")} — {s.careWorker.name} ({s.status})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
