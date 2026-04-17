import type { ComponentProps } from "react";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getHousingProperty, getCareWorkersForAssign } from "../actions";
import { HousingDetailClient } from "./HousingDetailClient";
import { ChevronLeft } from "lucide-react";

export default async function HousingPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  const property = await getHousingProperty(id);
  if (!property) notFound();

  const careWorkers = await getCareWorkersForAssign();

  const serialized = JSON.parse(
    JSON.stringify(property, (_k, v) =>
      typeof v === "bigint" ? v.toString() : v instanceof Date ? v.toISOString() : v
    )
  ) as ComponentProps<typeof HousingDetailClient>["initial"];

  return (
    <div className="space-y-6">
      <Link
        href="/housing"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        All properties
      </Link>
      <HousingDetailClient
        propertyId={id}
        initial={serialized}
        careWorkers={careWorkers}
      />
    </div>
  );
}
