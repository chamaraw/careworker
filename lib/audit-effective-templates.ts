import { prisma } from "@/lib/prisma";
import { loadCarePackageTemplatesByServiceUserId } from "@/lib/audit-care-package-templates";

export type EffectiveTemplateMeta = {
  id: string;
  name: string;
  category: string | null;
  fields?: unknown;
};

export type AuditAssignmentScope = "GLOBAL" | "PROPERTY" | "SERVICE_USER" | "CARE_PACKAGE";

export type TemplateWithFields = { id: string; name: string; fields: unknown };

/** In-memory merge for worker dashboard (single batched query set). */
export function mergeEffectiveAuditTemplates(
  propertyId: string,
  serviceUserId: string,
  globals: TemplateWithFields[],
  propertyRows: Array<{
    propertyId: string;
    formTemplate: TemplateWithFields & { isActive: boolean; assignmentScope: AuditAssignmentScope };
  }>,
  suRows: Array<{
    serviceUserId: string;
    formTemplateId: string;
    isActive: boolean;
    formTemplate: TemplateWithFields & { isActive: boolean; assignmentScope: AuditAssignmentScope };
  }>,
  carePackageTemplatesForUser: TemplateWithFields[]
): TemplateWithFields[] {
  const merged = new Map<string, TemplateWithFields>();
  for (const t of globals) merged.set(t.id, { id: t.id, name: t.name, fields: t.fields });
  for (const row of propertyRows) {
    if (row.propertyId !== propertyId) continue;
    const t = row.formTemplate;
    if (!t.isActive || t.assignmentScope !== "PROPERTY") continue;
    merged.set(t.id, { id: t.id, name: t.name, fields: t.fields });
  }
  for (const t of carePackageTemplatesForUser) {
    merged.set(t.id, { id: t.id, name: t.name, fields: t.fields });
  }
  for (const o of suRows) {
    if (o.serviceUserId !== serviceUserId) continue;
    const t = o.formTemplate;
    if (!t.isActive) continue;
    if (t.assignmentScope === "SERVICE_USER" && o.isActive) {
      merged.set(t.id, { id: t.id, name: t.name, fields: t.fields });
    }
    if (t.assignmentScope === "PROPERTY" && !o.isActive) {
      merged.delete(o.formTemplateId);
    }
    if (t.assignmentScope === "CARE_PACKAGE" && !o.isActive) {
      merged.delete(o.formTemplateId);
    }
  }
  return Array.from(merged.values());
}

/**
 * Templates shown in audit recording for a property and optional selected service user.
 * GLOBAL: always included. PROPERTY: property assignment rows. CARE_PACKAGE: from the person’s care package.
 * SERVICE_USER: active per-person rows only.
 * Per-person rows with isActive false on PROPERTY- or CARE_PACKAGE-scoped templates exclude that template for the person.
 */
export async function getEffectiveAuditTemplatesForRecording(
  propertyId: string,
  serviceUserId: string | null,
  options?: { includeFields?: boolean }
): Promise<EffectiveTemplateMeta[]> {
  const baseSelect = options?.includeFields
    ? ({ id: true, name: true, category: true, fields: true } as const)
    : ({ id: true, name: true, category: true } as const);

  const globals = await prisma.auditFormTemplate.findMany({
    where: { isActive: true, assignmentScope: "GLOBAL" },
    select: baseSelect,
  });

  const propRows = await prisma.propertyFormAssignment.findMany({
    where: { propertyId, isActive: true },
    include: {
      formTemplate: {
        select: {
          ...baseSelect,
          isActive: true,
          assignmentScope: true,
        },
      },
    },
  });

  const fromProperty = propRows
    .map((r) => r.formTemplate)
    .filter((t) => t.isActive && t.assignmentScope === "PROPERTY");

  const merged = new Map<string, EffectiveTemplateMeta>();

  const toMeta = (t: {
    id: string;
    name: string;
    category: string | null;
    fields?: unknown;
  }): EffectiveTemplateMeta => ({
    id: t.id,
    name: t.name,
    category: t.category,
    ...(options?.includeFields && t.fields !== undefined ? { fields: t.fields } : {}),
  });

  for (const t of globals) merged.set(t.id, toMeta(t));
  for (const t of fromProperty) merged.set(t.id, toMeta(t));

  if (serviceUserId) {
    const pkgMap = await loadCarePackageTemplatesByServiceUserId([serviceUserId]);
    for (const row of pkgMap.get(serviceUserId) ?? []) {
      merged.set(row.id, toMeta(row));
    }
  }

  if (serviceUserId) {
    const suRows = await prisma.serviceUserFormAssignment.findMany({
      where: { serviceUserId },
      include: {
        formTemplate: {
          select: {
            ...baseSelect,
            isActive: true,
            assignmentScope: true,
          },
        },
      },
    });
    for (const o of suRows) {
      const t = o.formTemplate;
      if (!t.isActive) continue;
      const scope = t.assignmentScope;
      if (scope === "SERVICE_USER" && o.isActive) {
        merged.set(t.id, toMeta(t));
      }
      if (scope === "PROPERTY" && !o.isActive) {
        merged.delete(o.formTemplateId);
      }
      if (scope === "CARE_PACKAGE" && !o.isActive) {
        merged.delete(o.formTemplateId);
      }
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}
