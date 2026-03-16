import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { getCarePlan } from "../../actions";
import { CarePlanEditForm } from "../../CarePlanEditForm";

export default async function EditCarePlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/care-plans");
  const { id } = await params;
  const plan = await getCarePlan(id);
  if (!plan) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit care plan</h1>
      <CarePlanEditForm plan={plan} />
    </div>
  );
}
