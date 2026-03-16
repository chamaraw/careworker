import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getCarePlan } from "../actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function CarePlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const plan = await getCarePlan(id);
  if (!plan) notFound();
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/care-plans">
          <Button variant="ghost" size="lg" className="min-h-[48px]">
            Back
          </Button>
        </Link>
        {isAdmin && (
          <Link href={`/care-plans/${id}/edit`}>
            <Button size="lg" className="min-h-[48px]">
              Edit
            </Button>
          </Link>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-2xl">{plan.title}</CardTitle>
          <Badge>{plan.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Service user:{" "}
            <Link
              href={`/service-users/${plan.serviceUser.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {plan.serviceUser.name}
            </Link>
          </p>
          {plan.reviewDate && (
            <p>Review date: {format(plan.reviewDate, "PPP")}</p>
          )}
          {plan.goals && (
            <div>
              <h3 className="font-semibold mb-1">Goals</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">{plan.goals}</p>
            </div>
          )}
          {plan.interventions && (
            <div>
              <h3 className="font-semibold mb-1">Interventions</h3>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {plan.interventions}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
