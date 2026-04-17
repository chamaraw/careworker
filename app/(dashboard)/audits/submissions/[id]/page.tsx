import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getFormSubmissionForViewer } from "../../actions";
import { ReviewSubmissionClient } from "./review-submission-client";
import { AuditSubmissionPreviewClient } from "./audit-submission-preview-client";
import Link from "next/link";
import { AuditReportFilingHeader } from "@/components/audits/AuditReportFilingHeader";
import { formatUkDateFromDate } from "@/lib/audit-form-dates";

export default async function AuditSubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  const { id } = await params;
  const submission = await getFormSubmissionForViewer(id);
  if (!submission) notFound();
  const isAdmin = role === "ADMIN";
  const isOwner = submission.submittedById === session.user.id;
  if (!isAdmin && !isOwner) redirect("/dashboard");

  const patientLine = submission.serviceUser
    ? (() => {
        const su = submission.serviceUser;
        const dob = formatUkDateFromDate(su.dateOfBirth);
        return dob ? `${su.name} · DOB ${dob}` : su.name;
      })()
    : null;
  const submittedAtLabel = submission.createdAt.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const fieldsJson = submission.formTemplate.fields;
  const previewFields = Array.isArray(fieldsJson)
    ? (fieldsJson as {
        key: string;
        label: string;
        type: string;
        required?: boolean;
        options?: string[];
        columns?: { key: string; label: string; type: string; options?: string[] }[];
      }[])
    : [];
  const patientDobIso = submission.serviceUser?.dateOfBirth
    ? submission.serviceUser.dateOfBirth.toISOString()
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/audits/recording?tab=reports" className="text-sm text-[#005EB8] underline">
          ← All reports
        </Link>
      </div>
      <AuditReportFilingHeader
        templateName={submission.formTemplate.name}
        propertyName={submission.property.name}
        patientLine={patientLine}
        recordedByName={submission.submittedBy.name ?? "Staff"}
        mode="submitted"
        submittedAtLabel={submittedAtLabel}
        statusLabel={submission.status}
      />
      <h2 className="text-lg font-semibold text-[#005EB8]">Form answers</h2>
      {previewFields.length > 0 ? (
        <AuditSubmissionPreviewClient
          templateName={submission.formTemplate.name}
          fields={previewFields}
          data={submission.data as Record<string, unknown>}
          patientSummary={patientLine}
          patientDateOfBirthIso={patientDobIso}
        />
      ) : (
        <p className="text-sm text-muted-foreground rounded border border-dashed p-4">
          This template has no field schema to preview. Use raw JSON below.
        </p>
      )}

      <details className="rounded-lg border bg-muted/20 text-sm">
        <summary className="cursor-pointer select-none px-4 py-3 font-medium text-[#005EB8]">
          Raw JSON (stored payload)
        </summary>
        <pre className="border-t p-3 text-xs overflow-auto max-h-[50vh]">{JSON.stringify(submission.data, null, 2)}</pre>
      </details>
      {isAdmin ? <ReviewSubmissionClient submissionId={submission.id} /> : null}
    </div>
  );
}
