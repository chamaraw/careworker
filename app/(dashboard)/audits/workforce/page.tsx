import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getWorkforceComplianceData,
  getTrainingMatrix,
  getExpiringStaffDocuments,
  getCompetencyProfiles,
  getCarePackagesForCompetencyAdmin,
} from "../actions";
import { WorkforceClient } from "./workforce-client";
import { prisma } from "@/lib/prisma";

export default async function WorkforceCompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");

  const [summary, matrix, expiringDocs, profilesRaw, carePackagesRaw, staffOptions] = await Promise.all([
    getWorkforceComplianceData(),
    getTrainingMatrix(),
    getExpiringStaffDocuments(60),
    getCompetencyProfiles(),
    getCarePackagesForCompetencyAdmin(),
    prisma.user.findMany({
      where: { role: "CARE_WORKER", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const docRows = expiringDocs as {
    id: string;
    user: { name: string };
    documentType: string;
    expiresAt: Date | null;
  }[];

  const profiles = profilesRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    linkedRequirementIds: p.requirements.map((x) => x.requirement.id),
  }));

  const carePackages = carePackagesRaw.map((cp) => ({
    id: cp.id,
    name: cp.name,
    slug: cp.slug,
    linkedProfileIds: cp.competencyProfiles.map((x) => x.competencyProfile.id),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Workforce compliance</h1>
      <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
        UK-supported-living style competency tracking: statutory/mandatory topics for all staff, plus pathway-specific
        training via <strong>competency profiles</strong>. Each requirement has a renewal period (leave blank in the
        database for a 12-month default; set to 0 only if that topic should not auto-expire). Workers see expiry dates on
        their dashboard, reminders in the notification bell, and alerts when training is missing, expired, or due
        within 60 days.
      </p>
      <WorkforceClient
        summary={summary}
        requirementColumns={matrix.requirementColumns.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          code: r.code,
          renewalMonths: r.renewalMonths,
          appliesToAllStaff: r.appliesToAllStaff,
        }))}
        rows={matrix.rows}
        profiles={profiles}
        carePackages={carePackages}
        staffOptions={staffOptions}
      />
      <div className="rounded border p-3 text-sm space-y-2">
        <p className="font-medium text-[#005EB8]">Expiring staff documents (60 days)</p>
        {docRows.length === 0 ? (
          <p className="text-muted-foreground">None in this window.</p>
        ) : (
          docRows.map((d) => (
            <div key={d.id} className="rounded border p-2">
              {d.user.name} · {d.documentType} · expires {d.expiresAt?.toISOString().slice(0, 10) ?? "—"}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
