import { auth } from "@/lib/auth";
import { getCarePlans } from "./actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function CarePlansPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceUser?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const params = await searchParams;
  const serviceUserId = params.serviceUser ?? undefined;
  const plans = await getCarePlans(serviceUserId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Care Plans</h1>
      <p className="text-muted-foreground">
        Person-centred care plans, goals, and review dates.
      </p>
      {isAdmin && (
        <Link href="/care-plans/new">
          <Button size="lg" className="min-h-[48px]">
            Add care plan
          </Button>
        </Link>
      )}
      <div className="space-y-4">
        {plans.length === 0 ? (
          <p className="text-muted-foreground py-4">No care plans.</p>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">
                  <Link href={`/care-plans/${plan.id}`} className="hover:underline">
                    {plan.title}
                  </Link>
                </CardTitle>
                <Badge variant="secondary">{plan.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Service user:{" "}
                  <Link
                    href={`/service-users/${plan.serviceUser.id}`}
                    className="hover:underline"
                  >
                    {plan.serviceUser.name}
                  </Link>
                </p>
                {plan.reviewDate && (
                  <p className="text-sm">
                    Review date: {format(plan.reviewDate, "PPP")}
                  </p>
                )}
                {plan.goals && (
                  <p className="text-sm line-clamp-2">{plan.goals}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
