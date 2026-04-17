import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditRecordingData } from "../actions";
import { AuditRecordingHubClient } from "./audit-recording-hub-client";

export default async function AuditRecordingPage({
  searchParams,
}: {
  searchParams: Promise<{
    submitted?: string;
    propertyId?: string;
    tab?: string;
    serviceUserId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { submitted, propertyId, tab, serviceUserId } = await searchParams;
  const initialTab = tab === "reports" ? "reports" : "record";

  const data = await getAuditRecordingData(propertyId || null, serviceUserId || null);
  const selectedPropertyId = data.effectivePropertyId ?? "";

  /** URL may still carry a patient id from another venue — only pass ids that exist on this property. */
  const rawServiceUserId = serviceUserId?.trim() ?? "";
  const effectiveServiceUserId = rawServiceUserId
    ? data.serviceUsers.some((su) => su.id === rawServiceUserId)
      ? rawServiceUserId
      : ""
    : "";

  if (rawServiceUserId && rawServiceUserId !== effectiveServiceUserId) {
    const p = new URLSearchParams();
    if (selectedPropertyId) p.set("propertyId", selectedPropertyId);
    if (effectiveServiceUserId) p.set("serviceUserId", effectiveServiceUserId);
    if (tab === "reports") p.set("tab", "reports");
    if (submitted === "1" || submitted === "true") p.set("submitted", "1");
    redirect(`/audits/recording?${p.toString()}`);
  }

  if (
    selectedPropertyId &&
    !serviceUserId &&
    data.serviceUsers.length === 1
  ) {
    const only = data.serviceUsers[0];
    const p = new URLSearchParams();
    p.set("propertyId", selectedPropertyId);
    p.set("serviceUserId", only.id);
    if (tab === "reports") p.set("tab", "reports");
    if (submitted === "1" || submitted === "true") p.set("submitted", "1");
    redirect(`/audits/recording?${p.toString()}`);
  }

  const mySubmissions = data.mySubmissions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    templateName: s.formTemplate.name,
    propertyName: s.property.name,
    serviceUserName: s.serviceUser?.name ?? null,
    status: s.status,
    submittedByName: s.submittedBy.name,
    submittedByEmail: s.submittedBy.email,
  }));

  const lastReportForPatient = data.lastReportForPatient
    ? {
        createdAt: data.lastReportForPatient.createdAt.toISOString(),
        templateName: data.lastReportForPatient.templateName,
        submittedByName: data.lastReportForPatient.submittedByName,
        submittedByEmail: data.lastReportForPatient.submittedByEmail,
      }
    : null;

  const serviceUsers = data.serviceUsers.map((su) => ({
    id: su.id,
    name: su.name,
    dateOfBirth: su.dateOfBirth?.toISOString() ?? null,
  }));

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <AuditRecordingHubClient
      submitted={submitted === "1" || submitted === "true"}
      initialTab={initialTab}
      selectedPropertyId={selectedPropertyId}
      serviceUserId={effectiveServiceUserId}
      isAdmin={isAdmin}
      templatesUsingDefaultFallback={data.templatesUsingDefaultFallback}
      properties={data.properties}
      templates={data.templates}
      serviceUsers={serviceUsers}
      mySubmissions={mySubmissions}
      lastReportForPatient={lastReportForPatient}
    />
  );
}
