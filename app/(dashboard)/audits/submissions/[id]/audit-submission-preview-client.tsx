"use client";

import { AuditFormRenderer } from "../../AuditFormRenderer";
import { stripAuditSubmissionMeta } from "@/lib/audit-form-server-validation";

type Field = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  columns?: {
    key: string;
    label: string;
    type: string;
    options?: string[];
    normalMin?: number;
    normalMax?: number;
    unit?: string;
  }[];
  defaultRows?: number;
  normalMin?: number;
  normalMax?: number;
  unit?: string;
};

export function AuditSubmissionPreviewClient({
  templateName,
  fields,
  data,
  patientSummary,
  patientDateOfBirthIso,
}: {
  templateName: string;
  fields: Field[];
  data: Record<string, unknown>;
  patientSummary: string | null;
  patientDateOfBirthIso: string | null;
}) {
  const initialValues = stripAuditSubmissionMeta(data);

  return (
    <AuditFormRenderer
      templateName={templateName}
      fields={fields}
      initialValues={initialValues}
      patientSummary={patientSummary}
      patientDateOfBirthIso={patientDateOfBirthIso}
      previewOnly
      readOnly
      onSubmit={async () => {}}
    />
  );
}
