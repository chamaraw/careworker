import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getHousingProperties } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreatePropertyForm } from "./CreatePropertyForm";
import { Building2, ChevronRight } from "lucide-react";

export default async function HousingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");

  const properties = await getHousingProperties();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="size-7" aria-hidden />
          Housing & service charges
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Properties, units, communal areas, H&amp;S inspections, maintenance,
          and tenant service charge records. Admin only.
        </p>
      </div>

      <CreatePropertyForm />

      <div className="grid gap-4 md:grid-cols-2">
        {properties.map((p) => (
          <Card key={p.id} className="hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{p.name}</CardTitle>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {[p.addressLine1, p.city, p.postcode].filter(Boolean).join(", ") ||
                  p.address ||
                  "No address on file"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Units: {p._count.units}</span>
                <span>Assets: {p._count.assets}</span>
                <span>Maintenance: {p._count.maintenanceTasks}</span>
                <span>Charge schedules: {p._count.serviceChargeSchedules}</span>
              </div>
              <Link href={`/housing/${p.id}`}>
                <Button variant="outline" size="sm" className="min-h-[40px] gap-1">
                  Open
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {properties.length === 0 && (
        <p className="text-muted-foreground py-6">
          No properties yet. Add one above to record units, H&amp;S, and service
          charges.
        </p>
      )}
    </div>
  );
}
