import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CQC_FRAMEWORK } from "@/lib/cqc-framework";
import { CqcAssessmentClient } from "./cqc-assessment-client";

export default async function CqcAssessmentPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const { propertyId } = await params;
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) redirect("/audits");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">CQC assessment: {property.name}</h1>
      <CqcAssessmentClient propertyId={property.id} framework={CQC_FRAMEWORK} />
    </div>
  );
}
