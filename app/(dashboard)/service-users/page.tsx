import { auth } from "@/lib/auth";
import { getServiceUsers } from "./actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
export default async function ServiceUsersPage() {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const users = await getServiceUsers();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Service Users</h1>
      <p className="text-muted-foreground">
        People we support. Tap a card for full profile, care plans, and history.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <Link key={u.id} href={`/service-users/${u.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50 min-h-[120px]">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Avatar className="size-12">
                  <AvatarFallback className="text-lg">
                    {u.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">{u.name}</CardTitle>
                  {u.careNeedsLevel && (
                    <Badge variant="secondary" className="mt-1">
                      {u.careNeedsLevel}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {u.allergies && (
                  <p className="truncate" title={u.allergies}>
                    Allergies: {u.allergies}
                  </p>
                )}
                {u.emergencyContactName && (
                  <p className="truncate">Emergency: {u.emergencyContactName}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {users.length === 0 && (
        <p className="text-muted-foreground py-8">No service users yet.</p>
      )}
      {isAdmin && (
        <Link href="/service-users/new">
          <Button size="lg" className="min-h-[48px]">
            Add service user
          </Button>
        </Link>
      )}
    </div>
  );
}
