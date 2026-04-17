import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getPropertyFormAssignments,
  getFormSubmissions,
  getAuditActions,
  getRiskEntries,
  getPropertyServiceUsers,
} from "../../actions";
import { getPropertyAuditBreakdown } from "../../manager/manager-actions";
import { ToggleAssignmentsClient } from "./toggle-assignments-client";
import { PropertyTemplateBreakdown } from "./property-template-breakdown";
import { ServiceUserAssignmentsClient } from "./service-user-assignments-client";
import { Button } from "@/components/ui/button";

export default async function AuditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  const [
    assignments,
    propertyScopedTemplates,
    globalTemplates,
    serviceUserOnlyTemplates,
    submissions,
    actions,
    risks,
    templateBreakdown,
    serviceUsers,
  ] = await Promise.all([
    getPropertyFormAssignments(id),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "PROPERTY" },
      select: {
        id: true,
        name: true,
        version: true,
        basedOn: { select: { id: true, name: true, version: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "GLOBAL" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "SERVICE_USER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getFormSubmissions({ propertyId: id, limit: 50 }),
    getAuditActions({ propertyId: id }),
    getRiskEntries({ propertyId: id, limit: 50 }),
    getPropertyAuditBreakdown(id),
    getPropertyServiceUsers(id),
  ]);

  const assignmentRows = assignments as {
    formTemplateId: string;
    isActive: boolean;
    assignedAt: Date;
    assignedTemplateVersion: number;
    formTemplate: {
      name: string;
      version: number;
      assignmentScope: string;
      basedOn?: { id: string; name: string; version: number } | null;
    };
    assignedBaseTemplate?: { id: string; name: string; version: number } | null;
  }[];

  const assignmentByTemplateId = new Map(assignmentRows.map((a) => [a.formTemplateId, a]));
  const templateToggleRows = propertyScopedTemplates.map((t) => {
    const a = assignmentByTemplateId.get(t.id);
    return {
      id: t.id,
      name: t.name,
      active: a?.isActive ?? false,
      onProperty: !!a,
      assignedAt: a ? a.assignedAt.toISOString() : null,
      assignedTemplateVersion: a?.assignedTemplateVersion ?? t.version,
      baseTemplateName: a?.assignedBaseTemplate?.name ?? t.basedOn?.name ?? null,
      baseTemplateVersion: a?.assignedBaseTemplate?.version ?? t.basedOn?.version ?? null,
      latestTemplateVersion: t.version,
    };
  });

  const propertyTemplatesAtVenue = templateToggleRows
    .filter((row) => row.active && row.onProperty)
    .map((row) => ({ id: row.id, name: row.name }));

  type SuRow = {
    id: string;
    carePackageId: string | null;
    carePackage: { id: string; name: string; slug: string } | null;
  };
  const suList = serviceUsers as SuRow[];
  const suIds = suList.map((s) => s.id);
  const packageIds = Array.from(
    new Set(suList.map((s) => s.carePackageId).filter((x): x is string => Boolean(x)))
  );

  const [allSuAssignments, packageTemplateLinks] = await Promise.all([
    suIds.length
      ? prisma.serviceUserFormAssignment.findMany({
          where: { serviceUserId: { in: suIds } },
          include: { formTemplate: { select: { id: true, assignmentScope: true } } },
        })
      : Promise.resolve([]),
    packageIds.length
      ? prisma.carePackageTemplate.findMany({
          where: { carePackageId: { in: packageIds } },
          include: {
            formTemplate: {
              select: { id: true, name: true, assignmentScope: true, isActive: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const assignmentsBySu = new Map<string, typeof allSuAssignments>();
  for (const row of allSuAssignments) {
    const list = assignmentsBySu.get(row.serviceUserId) ?? [];
    list.push(row);
    assignmentsBySu.set(row.serviceUserId, list);
  }

  const formsByPackageId = new Map<string, { id: string; name: string }[]>();
  const seenFormByPackage = new Map<string, Set<string>>();
  for (const link of packageTemplateLinks) {
    const ft = link.formTemplate;
    if (!ft.isActive) continue;
    let seen = seenFormByPackage.get(link.carePackageId);
    if (!seen) {
      seen = new Set();
      seenFormByPackage.set(link.carePackageId, seen);
    }
    if (seen.has(ft.id)) continue;
    seen.add(ft.id);
    const list = formsByPackageId.get(link.carePackageId) ?? [];
    list.push({ id: ft.id, name: ft.name });
    formsByPackageId.set(link.carePackageId, list);
  }

  const serviceUserPanelById: Record<
    string,
    {
      personalFormIds: string[];
      excludedPropertyTemplateIds: string[];
      excludedCarePackageTemplateIds: string[];
    }
  > = {};

  const carePackageSectionByServiceUserId: Record<
    string,
    { packageName: string | null; forms: { id: string; name: string }[] }
  > = {};

  for (const su of suList) {
    const rows = assignmentsBySu.get(su.id) ?? [];
    const personalFormIds: string[] = [];
    const excludedPropertyTemplateIds: string[] = [];
    const excludedCarePackageTemplateIds: string[] = [];
    for (const r of rows) {
      if (r.formTemplate.assignmentScope === "SERVICE_USER" && r.isActive) {
        personalFormIds.push(r.formTemplateId);
      }
      if (r.formTemplate.assignmentScope === "PROPERTY" && !r.isActive) {
        excludedPropertyTemplateIds.push(r.formTemplateId);
      }
      if (r.formTemplate.assignmentScope === "CARE_PACKAGE" && !r.isActive) {
        excludedCarePackageTemplateIds.push(r.formTemplateId);
      }
    }
    serviceUserPanelById[su.id] = {
      personalFormIds,
      excludedPropertyTemplateIds,
      excludedCarePackageTemplateIds,
    };
    const pkgForms = su.carePackageId ? (formsByPackageId.get(su.carePackageId) ?? []) : [];
    carePackageSectionByServiceUserId[su.id] = {
      packageName: su.carePackage?.name ?? null,
      forms: pkgForms,
    };
  }

  const submissionRows = submissions as { id: string; status: string; formTemplate: { name: string } }[];
  const actionRows = actions as { id: string; description: string; status: string }[];
  const riskRows = risks as { id: string; title: string; riskScore: number; status: string }[];

  const linkedIncidents = await prisma.incidentReport.findMany({
    where: { serviceUser: { propertyId: id } },
    include: {
      serviceUser: { select: { id: true, name: true } },
      careWorker: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/audits/manager" className="underline text-[#005EB8] font-medium">
          Audit manager
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground font-medium">{property.name}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Property audit: {property.name}</h1>
        <Link href="/audits/templates?scope=PROPERTY">
          <Button className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]">
            Create property template
          </Button>
        </Link>
      </div>

      <ToggleAssignmentsClient
        propertyId={id}
        templates={templateToggleRows}
        globalTemplates={globalTemplates}
      />

      <ServiceUserAssignmentsClient
        serviceUsers={(serviceUsers as { id: string; name: string; dateOfBirth: Date | null }[]).map((su) => ({
          id: su.id,
          name: su.name,
          dateOfBirth: su.dateOfBirth ? su.dateOfBirth.toISOString() : null,
        }))}
        personOnlyTemplates={serviceUserOnlyTemplates}
        propertyTemplatesAtVenue={propertyTemplatesAtVenue}
        initialPanelByServiceUserId={serviceUserPanelById}
        carePackageSectionByServiceUserId={carePackageSectionByServiceUserId}
      />

      <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-[#005EB8] text-lg">Template completion & tracking</h2>
        <PropertyTemplateBreakdown propertyId={id} rows={templateBreakdown} />
      </div>

      <div>
        <h2 className="font-medium mb-2">Recent submissions</h2>
        <div className="space-y-2">
          {submissionRows.map((s) => (
            <div key={s.id} className="rounded border p-2 flex items-center justify-between">
              <div>
                {s.formTemplate.name} · {s.status}
              </div>
              <Link href={`/audits/submissions/${s.id}`} className="underline text-sm">
                Open
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium mb-2">Open actions</h2>
        <div className="space-y-2">
          {actionRows.map((a) => (
            <div key={a.id} className="rounded border p-2">
              {a.description} · {a.status}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium mb-2">Risk register</h2>
        <div className="space-y-2">
          {riskRows.map((r) => (
            <div key={r.id} className="rounded border p-2">
              {r.title} · score {r.riskScore} · {r.status}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium mb-2">Linked events (incidents)</h2>
        <div className="space-y-2">
          {linkedIncidents.map((inc) => (
            <div key={inc.id} className="rounded border p-2 text-sm">
              {inc.serviceUser.name} · {inc.severity} · {inc.status} · {inc.description}
            </div>
          ))}
          {linkedIncidents.length === 0 && (
            <p className="text-sm text-muted-foreground">No incidents linked to this property yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
