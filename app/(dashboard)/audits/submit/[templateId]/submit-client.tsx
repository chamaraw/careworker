"use client";

import { useRouter } from "next/navigation";
import { createFormSubmission } from "../../actions";
import { AuditFormRenderer } from "../../AuditFormRenderer";

export function SubmitAuditFormClient({
  templateId,
  propertyId,
  serviceUserId,
  fields,
  templateName,
  propertyName,
  recordedByName,
  aiAssistantPrompt,
  patientSummary,
  patientDateOfBirthIso,
  initialValues,
}: {
  templateId: string;
  propertyId: string;
  serviceUserId?: string;
  templateName: string;
  propertyName: string;
  recordedByName: string;
  aiAssistantPrompt?: string | null;
  patientSummary?: string | null;
  patientDateOfBirthIso?: string | null;
  initialValues?: Record<string, unknown>;
  fields: { key: string; label: string; type: string; required?: boolean; options?: string[]; columns?: { key: string; label: string; type: string }[]; defaultRows?: number }[];
}) {
  const router = useRouter();
  return (
    <AuditFormRenderer
      templateName={templateName}
      propertyName={propertyName}
      recordedByName={recordedByName}
      aiAssistantPrompt={aiAssistantPrompt}
      fields={fields}
      patientSummary={patientSummary}
      patientDateOfBirthIso={patientDateOfBirthIso}
      initialValues={initialValues}
      onSubmit={async (payload) => {
        const submittedAt = new Date().toISOString();
        const withMeta = {
          ...payload,
          __recording: {
            ...(typeof payload.__recording === "object" && payload.__recording !== null
              ? (payload.__recording as Record<string, unknown>)
              : {}),
            clientSubmittedAt: submittedAt,
            templateName,
            propertyId,
            serviceUserId: serviceUserId ?? null,
          },
        };
        await createFormSubmission({
          formTemplateId: templateId,
          propertyId,
          serviceUserId: serviceUserId ?? null,
          payload: withMeta as object,
          status: "SUBMITTED",
        });
        const q = new URLSearchParams();
        q.set("submitted", "1");
        q.set("tab", "reports");
        q.set("propertyId", propertyId);
        router.push(`/audits/recording?${q.toString()}`);
        router.refresh();
      }}
    />
  );
}
