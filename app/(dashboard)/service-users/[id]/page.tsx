import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getServiceUserDetail } from "../actions";
import { getAuditSubmissionsForServiceUser } from "../../audits/actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CarePackageAuditAssignments } from "@/components/service-users/CarePackageAuditAssignments";
import { ServiceUserPersonalAudits } from "@/components/service-users/ServiceUserPersonalAudits";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";

export default async function ServiceUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;
  const [user, auditReports] = await Promise.all([
    getServiceUserDetail(id),
    getAuditSubmissionsForServiceUser(id, 30),
  ]);
  if (!user) notFound();
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const carePackageAudits =
    user.carePackage?.templates
      ?.map((t) => t.formTemplate)
      .filter((t) => t.isActive)
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];
  const linkedCarePackageTemplateIds = carePackageAudits.map((t) => t.id);
  const excludedCarePackageTemplateIds = isAdmin
    ? linkedCarePackageTemplateIds.length === 0
      ? []
      : (
          await prisma.serviceUserFormAssignment.findMany({
            where: {
              serviceUserId: user.id,
              isActive: false,
              formTemplateId: { in: linkedCarePackageTemplateIds },
            },
            select: { formTemplateId: true },
          })
        ).map((r) => r.formTemplateId)
    : [];
  const personalTemplates = isAdmin
    ? await prisma.auditFormTemplate.findMany({
        where: { isActive: true, assignmentScope: "SERVICE_USER" },
        select: { id: true, name: true, category: true },
        orderBy: { name: "asc" },
      })
    : [];
  const assignedPersonalTemplateIds = isAdmin
    ? (
        await prisma.serviceUserFormAssignment.findMany({
          where: { serviceUserId: user.id, isActive: true },
          include: { formTemplate: { select: { assignmentScope: true } } },
        })
      )
        .filter((r) => r.formTemplate.assignmentScope === "SERVICE_USER")
        .map((r) => r.formTemplateId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/service-users">
          <Button variant="ghost" size="lg" className="min-h-[48px]">
            Back
          </Button>
        </Link>
        {isAdmin && (
          <Link href={`/service-users/${id}/edit`}>
            <Button size="lg" className="min-h-[48px]">
              Edit
            </Button>
          </Link>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="text-2xl">
              {user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl">{user.name}</CardTitle>
            {user.dateOfBirth && (
              <p className="text-muted-foreground">
                DOB: {format(user.dateOfBirth, "PPP")}
              </p>
            )}
            {user.careNeedsLevel && (
              <p className="text-sm text-muted-foreground">
                Care needs: {user.careNeedsLevel}
              </p>
            )}
            {user.carePackage && (
              <p className="text-sm text-muted-foreground">
                Care package: {user.carePackage.name}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-semibold">Address</h3>
            <p className="text-muted-foreground">{user.address || "—"}</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Allergies</h3>
            <p className="text-muted-foreground">{user.allergies || "—"}</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <h3 className="font-semibold">Medical notes</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {user.medicalNotes || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Emergency contact</h3>
            <p className="text-muted-foreground">
              {user.emergencyContactName || "—"}
              {user.emergencyContactPhone && ` · ${user.emergencyContactPhone}`}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Care package audits</CardTitle>
          {isAdmin ? (
            <Link href="/audits/care-packages">
              <Button variant="ghost" size="sm">
                Manage links
              </Button>
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {!user.carePackage ? (
            <p className="text-muted-foreground">No care package assigned.</p>
          ) : carePackageAudits.length === 0 ? (
            <p className="text-muted-foreground">
              {user.carePackage.name} has no linked audit templates yet. Add templates under{" "}
              <Link href="/audits/care-packages" className="text-[#005EB8] underline">
                Audits → Care packages
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Package: <span className="font-medium text-foreground">{user.carePackage.name}</span>
              </p>
              {isAdmin ? (
                <CarePackageAuditAssignments
                  serviceUserId={user.id}
                  templates={carePackageAudits.map((t) => ({ id: t.id, name: t.name, category: t.category ?? null }))}
                  initialExcludedTemplateIds={excludedCarePackageTemplateIds}
                />
              ) : (
                <ul className="space-y-2">
                  {carePackageAudits.map((t) => (
                    <li
                      key={t.id}
                      className="text-sm flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground">{t.category ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {isAdmin ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Additional audits (person-only)</CardTitle>
            <Link href="/audits/templates?scope=SERVICE_USER">
              <Button variant="ghost" size="sm">
                Create person-only template
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {personalTemplates.length === 0 ? (
              <p className="text-muted-foreground">
                No person-only templates yet. Create one and set assignment to{" "}
                <strong className="text-foreground">Per service user only</strong>.
              </p>
            ) : (
              <ServiceUserPersonalAudits
                serviceUserId={user.id}
                templates={personalTemplates.map((t) => ({ id: t.id, name: t.name, category: t.category ?? null }))}
                initialAssignedTemplateIds={assignedPersonalTemplateIds}
              />
            )}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Audit reports</CardTitle>
          <Link
            href={`/audits/recording?${new URLSearchParams({
              ...(user.propertyId ? { propertyId: user.propertyId } : {}),
              serviceUserId: user.id,
              tab: "reports",
            }).toString()}`}
          >
            <Button variant="ghost" size="sm">
              All reports
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {auditReports.length === 0 ? (
            <p className="text-muted-foreground">
              No audit filings linked to this person yet. Staff can record from{" "}
              <Link href="/audits/recording" className="text-[#005EB8] underline">
                Audit recording
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {auditReports.map((r) => (
                <li key={r.id} className="text-sm flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0">
                  <div>
                    <Link href={`/audits/submissions/${r.id}`} className="font-medium text-[#005EB8] hover:underline">
                      {r.formTemplate.name}
                    </Link>
                    <span className="text-muted-foreground ml-2">{r.property.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {format(r.createdAt, "PPp")} · {r.submittedBy.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Care plans</CardTitle>
          <Link href={`/care-plans?serviceUser=${user.id}`}>
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.carePlans.length === 0 ? (
            <p className="text-muted-foreground">No care plans.</p>
          ) : (
            <ul className="space-y-2">
              {user.carePlans.map((p) => (
                <li key={p.id}>
                  <Link href={`/care-plans/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                  <span className="text-muted-foreground text-sm ml-2">
                    {p.status} · Review {p.reviewDate ? format(p.reviewDate, "P") : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent incidents</CardTitle>
          <Link href="/incidents">
            <Button variant="ghost" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.incidentReports.length === 0 ? (
            <p className="text-muted-foreground">No incidents.</p>
          ) : (
            <ul className="space-y-2">
              {user.incidentReports.map((i) => (
                <li key={i.id} className="text-sm">
                  <span className="font-medium">{i.severity}</span> — {format(i.occurredAt, "PP")} — {i.careWorker.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent shifts</CardTitle>
          <Link href="/roster">
            <Button variant="ghost" size="sm">View roster</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {user.shifts.length === 0 ? (
            <p className="text-muted-foreground">No shifts.</p>
          ) : (
            <ul className="space-y-2">
              {user.shifts.map((s) => (
                <li key={s.id} className="text-sm">
                  {format(s.startAt, "PPp")} — {s.careWorker.name} ({s.status})
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
