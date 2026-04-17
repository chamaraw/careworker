import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getFormTemplateForSubmission, getServiceUserForAuditForm } from "../../actions";
import { FormWizardClient } from "./form-wizard-client";
import { buildPatientInitialValues } from "@/lib/audit-form-initial-values";
import { formatUkDateFromDate } from "@/lib/audit-form-dates";
import { prisma } from "@/lib/prisma";

export default async function SubmitAuditFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ propertyId?: string; serviceUserId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { templateId } = await params;
  const query = await searchParams;
  const template = await getFormTemplateForSubmission(templateId);
  if (!template) notFound();
  if (!query.propertyId) return <p>Missing propertyId query parameter.</p>;

  const property = await prisma.property.findFirst({
    where: { id: query.propertyId },
    select: { name: true },
  });
  const propertyName = property?.name ?? "Venue";
  const recordedByName =
    session.user?.name?.trim() || session.user?.email?.trim() || "Staff";

  const fields = Array.isArray(template.fields) ? (template.fields as { key: string; label: string; type: string }[]) : [];

  let initialValues: Record<string, unknown> | undefined;
  let patientSummary: string | null = null;
  let patientDateOfBirthIso: string | null = null;
  if (query.serviceUserId) {
    const patient = await getServiceUserForAuditForm(query.serviceUserId, query.propertyId);
    if (patient) {
      initialValues = buildPatientInitialValues(fields, {
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
      });
      const dob = formatUkDateFromDate(patient.dateOfBirth);
      patientSummary = dob ? `${patient.name} · DOB ${dob}` : patient.name;
      patientDateOfBirthIso = patient.dateOfBirth ? patient.dateOfBirth.toISOString() : null;
    }
  }

  const backQs = new URLSearchParams();
  backQs.set("propertyId", query.propertyId);
  if (query.serviceUserId) backQs.set("serviceUserId", query.serviceUserId);
  backQs.set("tab", "record");

  return (
    <div className="space-y-4">
      <Link
        href={`/audits/recording?${backQs.toString()}`}
        className="text-sm text-[#005EB8] underline inline-block min-h-[44px] py-2 touch-manipulation"
      >
        ← Back to form recording
      </Link>
      <FormWizardClient
        templateId={template.id}
        propertyId={query.propertyId}
        serviceUserId={query.serviceUserId}
        templateName={template.name}
        propertyName={propertyName}
        recordedByName={recordedByName}
        aiAssistantPrompt={template.aiAssistantPrompt ?? null}
        patientSummary={patientSummary}
        patientDateOfBirthIso={patientDateOfBirthIso}
        initialValues={initialValues}
        fields={fields as never[]}
      />
    </div>
  );
}
