import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getStaff } from "./actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StaffForm } from "./StaffForm";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");
  const staff = await getStaff();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <p className="text-muted-foreground">
        Care worker management. Add, edit, or deactivate staff.
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
              {s.phone && <p>Phone: {s.phone}</p>}
              {s.qualifications && <p>Qualifications: {s.qualifications}</p>}
              <p className="text-muted-foreground">
                Shifts assigned: {s._count.shiftsAsWorker}
              </p>
              <Link href={`/staff/${s.id}/edit`}>
                <Button variant="outline" size="sm" className="mt-2 min-h-[40px]">
                  Edit
                </Button>
              </Link>
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
