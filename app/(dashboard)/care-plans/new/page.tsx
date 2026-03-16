import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CarePlanForm } from "../CarePlanForm";

export default async function NewCarePlanPage() {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/care-plans");
  const serviceUsers = await prisma.serviceUser.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add care plan</h1>
      <CarePlanForm serviceUsers={serviceUsers} />
    </div>
  );
}
