import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCarePackagesAdminData } from "./care-package-actions";
import { CarePackagesAdminClient } from "./CarePackagesAdminClient";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CarePackagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");

  const data = await getCarePackagesAdminData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/audits" className="underline text-[#005EB8] font-medium">
          Audits
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground font-medium">Care packages</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Care packages & audit forms</h1>
        <Link href="/audits/templates">
          <Button className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]">New audit template</Button>
        </Link>
      </div>
      <CarePackagesAdminClient packages={data.packages} linkableTemplates={data.linkableTemplates} />
    </div>
  );
}
