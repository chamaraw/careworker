import { formatUkDateFromDate } from "@/lib/audit-form-dates";

type FieldLike = { key: string; label: string; type: string };

/**
 * Fills name / DOB fields when keys or labels match common audit templates.
 */
export function buildPatientInitialValues(fields: FieldLike[], patient: { name: string; dateOfBirth: Date | null }) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === "SECTION_HEADER" || f.type === "INFO_TEXT") continue;
    const key = f.key.toLowerCase().replace(/\s+/g, "_");
    const label = f.label.toLowerCase();

    const isNameField =
      key === "service_user_name" ||
      key === "patient_name" ||
      key === "resident_name" ||
      key === "su_name" ||
      key === "name_of_resident" ||
      (key.includes("service") && key.includes("user") && key.includes("name")) ||
      (label.includes("service user") && label.includes("name")) ||
      (label.includes("resident") && label.includes("name")) ||
      (label.includes("patient") && label.includes("name") && !label.includes("urgent"));

    const isDobField =
      key === "date_of_birth" ||
      key === "dob" ||
      key === "patient_dob" ||
      (key.includes("date") && key.includes("birth")) ||
      label.includes("date of birth") ||
      label.includes("d.o.b") ||
      label === "dob";

    if (isNameField && (f.type === "TEXT" || f.type === "TEXTAREA")) {
      out[f.key] = patient.name;
    }
    if (isDobField && patient.dateOfBirth && (f.type === "DATE" || f.type === "TEXT" || f.type === "TEXTAREA")) {
      out[f.key] = formatUkDateFromDate(patient.dateOfBirth);
    }
  }
  return out;
}
