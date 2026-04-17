"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type {
  AuditActionPriority,
  AuditActionStatus,
  AuditScheduleFrequency,
  AuditSubmissionStatus,
  AuditTemplateAssignmentScope,
  CqcKeyQuestion,
  CqcRating,
  Prisma,
  RiskImpact,
  RiskLikelihood,
  RiskStatus,
} from "@prisma/client";
import { getCqcRatingFromPercent } from "@/lib/cqc-framework";
import { getSystemAuditTemplatePack, resolvePackEntryAiPrompt } from "@/lib/audit-templates/pack";
import { parseAuditTemplateFields } from "@/lib/audit-template-schema";
import {
  getAllSubmissionBlockingIssues,
  resolveAgeYearsForAuditSubmission,
  stripAuditSubmissionMeta,
} from "@/lib/audit-form-server-validation";
import { startOfDay, endOfDay, format } from "date-fns";
import {
  auditTemplateLooksTwiceDaily,
  countSubmissionsTodayLondon,
  type WorkerAuditReminderItem,
} from "@/lib/audit-reminders";
import {
  getEffectiveAuditTemplatesForRecording,
  mergeEffectiveAuditTemplates,
} from "@/lib/audit-effective-templates";
import { loadCarePackageTemplatesByServiceUserId } from "@/lib/audit-care-package-templates";
import {
  applicableRequirementIdsForUser,
  COMPETENCY_NOTIFICATION_LINK_PREFIX,
  computeExpiresAtForNewRecord,
  indexLatestRecordsByUserRequirement,
  resolveCompetencyStatus,
  tallyOrgCompetencyGaps,
} from "@/lib/staff-competency";
import { buildAuditTemplateChangePayload, type AuditTemplateSnapshot } from "@/lib/audit-template-change-diff";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");
  return session;
}

async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

/** Venues shown in audit recording: all for admins; care workers see shifts/time-records venues, else every venue (same idea as clock-in). */
async function getPropertiesVisibleForAuditRecording(userId: string, role: string | undefined) {
  if (role === "ADMIN") {
    return prisma.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  const [shifts, timeRows] = await Promise.all([
    prisma.shift.findMany({
      where: { careWorkerId: userId },
      select: { propertyId: true, serviceUser: { select: { propertyId: true } } },
      take: 2000,
    }),
    prisma.timeRecord.findMany({
      where: { userId },
      select: { propertyId: true },
      take: 1000,
    }),
  ]);

  const ids = new Set<string>();
  for (const s of shifts) {
    if (s.propertyId) ids.add(s.propertyId);
    if (s.serviceUser?.propertyId) ids.add(s.serviceUser.propertyId);
  }
  for (const t of timeRows) ids.add(t.propertyId);

  if (ids.size === 0) {
    return prisma.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return prisma.property.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getAuditDashboardData() {
  await requireAdmin();
  try {
    const auditActionModel = (prisma as unknown as PrismaClientWithAuditAction).auditAction;
    if (auditActionModel) {
      await auditActionModel.updateMany({
        where: {
          dueDate: { lt: new Date() },
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        data: { status: "OVERDUE" },
      });
    }
    const [properties, openActions, overdueActions, recentSubmissions, linkedIncidentActions] = await Promise.all([
      prisma.property.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { auditFormSubmissions: true, auditActions: true, riskEntries: true } },
          cqcAssessments: { orderBy: { assessmentDate: "desc" }, take: 1, select: { overallRating: true } },
        },
      }),
      auditActionModel
        ? auditActionModel.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } })
        : Promise.resolve(0),
      auditActionModel
        ? auditActionModel.count({
            where: { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] }, dueDate: { lt: new Date() } },
          })
        : Promise.resolve(0),
      prisma.auditFormSubmission.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          formTemplate: { select: { name: true } },
          property: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
      }),
      auditActionModel ? auditActionModel.count({ where: { incidentId: { not: null } } }) : Promise.resolve(0),
    ]);
    return { properties, openActions, overdueActions, recentSubmissions, linkedIncidentActions };
  } catch (error) {
    if (!isMissingAuditTableError(error)) throw error;
    const properties = await prisma.property.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return {
      properties: properties.map((p) => ({
        ...p,
        _count: { auditFormSubmissions: 0, auditActions: 0, riskEntries: 0 },
        cqcAssessments: [],
      })),
      openActions: 0,
      overdueActions: 0,
      recentSubmissions: [],
      linkedIncidentActions: 0,
    };
  }
}

type PrismaClientWithAuditAction = Prisma.TransactionClient & {
  auditAction?: {
    updateMany: (args: Prisma.AuditActionUpdateManyArgs) => Promise<unknown>;
    count: (args?: Prisma.AuditActionCountArgs) => Promise<number>;
  };
};

function isMissingAuditTableError(error: unknown) {
  return error instanceof Error && /does not exist/i.test(error.message) && /Audit/i.test(error.message);
}

/** Ensures Prisma/Postgres JSON storage never receives non-serializable values from the client payload. */
const TEMPLATE_CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

function assertValidTemplateCode(raw: string | null | undefined) {
  if (raw == null || raw === "") return;
  const t = raw.trim();
  if (!TEMPLATE_CODE_RE.test(t)) {
    throw new Error(
      "Template code must start with a letter and contain only letters, numbers, and underscores (e.g. medication_round_audit)."
    );
  }
}

function sanitizeJsonForAuditStorage(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
    ) as Prisma.InputJsonValue;
  } catch {
    throw new Error("Report could not be saved. Remove unusual characters and try again.");
  }
}

export async function getFormTemplates() {
  await requireAdmin();
  return prisma.auditFormTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function getFormTemplate(id: string) {
  await requireAdmin();
  return prisma.auditFormTemplate.findUnique({ where: { id } });
}

export async function getAuditTemplateChangeLogs(formTemplateId: string, take = 50) {
  await requireAdmin();
  return prisma.auditFormTemplateChangeLog.findMany({
    where: { formTemplateId },
    orderBy: { createdAt: "desc" },
    take,
    include: { changedBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function getFormTemplateForSubmission(id: string) {
  await requireAuthenticatedUser();
  return prisma.auditFormTemplate.findFirst({ where: { id, isActive: true } });
}

export async function getAuditRecordingOptions() {
  await requireAuthenticatedUser();
  const [properties, templates] = await Promise.all([
    prisma.property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { properties, templates };
}

/** Recording hub: assigned templates per property, service users, worker's submissions. */
export async function getAuditRecordingData(
  requestedPropertyId: string | null | undefined,
  selectedServiceUserId?: string | null
) {
  const session = await requireAuthenticatedUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  const role = (session.user as { role?: string }).role;

  const properties = await getPropertiesVisibleForAuditRecording(userId, role);
  const idSet = new Set(properties.map((p) => p.id));
  const effectivePropertyId =
    requestedPropertyId && idSet.has(requestedPropertyId)
      ? requestedPropertyId
      : properties[0]?.id ?? null;

  let templates: { id: string; name: string; category: string | null }[] = [];
  /** True when a venue is selected but no forms apply (no globals, property forms, or person-only forms for patient). */
  let templatesUsingDefaultFallback = false;
  let serviceUsers: { id: string; name: string; dateOfBirth: Date | null }[] = [];
  let lastReportForPatient: {
    createdAt: Date;
    templateName: string;
    submittedByName: string | null;
    submittedByEmail: string | null;
  } | null = null;

  if (effectivePropertyId) {
    serviceUsers = await prisma.serviceUser.findMany({
      where: { propertyId: effectivePropertyId },
      select: { id: true, name: true, dateOfBirth: true },
      orderBy: { name: "asc" },
    });

    const patientId =
      selectedServiceUserId &&
      serviceUsers.some((su) => su.id === selectedServiceUserId)
        ? selectedServiceUserId
        : null;

    const effective = await getEffectiveAuditTemplatesForRecording(effectivePropertyId, patientId);
    templates = effective.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    }));
    templatesUsingDefaultFallback = templates.length === 0;

    if (patientId) {
      const last = await prisma.auditFormSubmission.findFirst({
        where: { propertyId: effectivePropertyId, serviceUserId: patientId },
        orderBy: { createdAt: "desc" },
        include: {
          formTemplate: { select: { name: true } },
          submittedBy: { select: { name: true, email: true } },
        },
      });
      if (last) {
        lastReportForPatient = {
          createdAt: last.createdAt,
          templateName: last.formTemplate.name,
          submittedByName: last.submittedBy.name,
          submittedByEmail: last.submittedBy.email,
        };
      }
    }
  }

  const mySubmissions = await prisma.auditFormSubmission.findMany({
    where: {
      submittedById: userId,
      ...(effectivePropertyId ? { propertyId: effectivePropertyId } : {}),
    },
    include: {
      formTemplate: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
      serviceUser: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    properties,
    templates,
    serviceUsers,
    mySubmissions,
    effectivePropertyId,
    templatesUsingDefaultFallback,
    lastReportForPatient,
  };
}

export async function getServiceUserForAuditForm(serviceUserId: string, propertyId: string) {
  await requireAuthenticatedUser();
  return prisma.serviceUser.findFirst({
    where: { id: serviceUserId, propertyId },
    select: { id: true, name: true, dateOfBirth: true, propertyId: true },
  });
}

export async function createFormTemplate(data: {
  name: string;
  description?: string;
  category?: string;
  assignmentScope?: AuditTemplateAssignmentScope;
  fields: Prisma.InputJsonValue;
  basedOnTemplateId?: string | null;
  aiAssistantPrompt?: string | null;
  templateCode?: string | null;
}) {
  await requireAdmin();
  const parsedFields = parseAuditTemplateFields(data.fields);
  if (!parsedFields.ok) throw new Error(`Invalid template fields: ${parsedFields.error}`);
  const fieldsJson = sanitizeJsonForAuditStorage(parsedFields.fields) as Prisma.InputJsonValue;
  assertValidTemplateCode(data.templateCode ?? null);
  const scope = data.assignmentScope ?? "PROPERTY";
  const template = await prisma.auditFormTemplate.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      assignmentScope: scope,
      fields: fieldsJson,
      basedOnTemplateId: data.basedOnTemplateId ?? null,
      aiAssistantPrompt: data.aiAssistantPrompt?.trim() || null,
      templateCode: data.templateCode?.trim() || null,
      version: 1,
      isActive: true,
    },
  });
  revalidatePath("/audits/templates");
  return template;
}

/** Idempotent: creates missing system templates from the repo pack (matched by templateCode or name). */
export async function createDefaultAuditTemplates() {
  await requireAdmin();
  const pack = getSystemAuditTemplatePack();
  let created = 0;
  for (const tpl of pack) {
    const orFilter: Prisma.AuditFormTemplateWhereInput[] = [{ name: tpl.name }];
    if (tpl.templateCode) {
      orFilter.unshift({ templateCode: tpl.templateCode });
    }
    const exists = await prisma.auditFormTemplate.findFirst({
      where: { OR: orFilter },
    });
    if (exists) continue;
    await prisma.auditFormTemplate.create({
      data: {
        templateCode: tpl.templateCode ?? null,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        assignmentScope: tpl.assignmentScope ?? "PROPERTY",
        fields: sanitizeJsonForAuditStorage(tpl.fields),
        aiAssistantPrompt: resolvePackEntryAiPrompt(tpl),
        isSystem: true,
        isActive: true,
      },
    });
    created += 1;
  }
  revalidatePath("/audits/templates");
  return { created };
}

/** Duplicate a template for editing (fork). Copies fields and metadata; clears templateCode and isSystem. */
export async function duplicateAuditFormTemplate(sourceId: string) {
  await requireAdmin();
  const src = await prisma.auditFormTemplate.findUnique({ where: { id: sourceId } });
  if (!src) throw new Error("Template not found");
  const copy = await prisma.auditFormTemplate.create({
    data: {
      name: `${src.name} (copy)`,
      description: src.description,
      category: src.category,
      assignmentScope: src.assignmentScope,
      fields: sanitizeJsonForAuditStorage(src.fields),
      aiAssistantPrompt: src.aiAssistantPrompt,
      filingFrequency: src.filingFrequency,
      monthlyFilingDueDay: src.monthlyFilingDueDay,
      basedOnTemplateId: src.id,
      templateCode: null,
      isSystem: false,
      isActive: true,
      version: 1,
    },
  });
  revalidatePath("/audits/templates");
  return copy;
}

/** Replace template fields from JSON (validated). Admin only. */
export async function importAuditTemplateFieldsFromJson(templateId: string, rawJson: string) {
  await requireAdmin();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error("Invalid JSON — check brackets and quotes.");
  }
  const result = parseAuditTemplateFields(parsed);
  if (!result.ok) throw new Error(result.error);
  await updateFormTemplate(templateId, {
    fields: result.fields as unknown as Prisma.InputJsonValue,
  });
}

function toTemplateSnapshot(row: {
  name: string;
  description: string | null;
  category: string | null;
  assignmentScope: AuditTemplateAssignmentScope;
  templateCode: string | null;
  aiAssistantPrompt: string | null;
  fields: unknown;
  filingFrequency: AuditScheduleFrequency;
  monthlyFilingDueDay: number | null;
  isActive: boolean;
}): AuditTemplateSnapshot {
  return {
    name: row.name,
    description: row.description,
    category: row.category,
    assignmentScope: row.assignmentScope,
    templateCode: row.templateCode,
    aiAssistantPrompt: row.aiAssistantPrompt,
    fields: row.fields,
    filingFrequency: row.filingFrequency,
    monthlyFilingDueDay: row.monthlyFilingDueDay ?? null,
    isActive: row.isActive,
  };
}

export async function updateFormTemplate(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    category: string | null;
    assignmentScope: AuditTemplateAssignmentScope;
    fields: Prisma.InputJsonValue;
    isActive: boolean;
    aiAssistantPrompt: string | null;
    templateCode: string | null;
    filingFrequency: AuditScheduleFrequency;
    monthlyFilingDueDay: number | null;
  }>
) {
  const session = await requireAdmin();
  const editorId = session.user?.id ?? null;
  if (data.templateCode !== undefined) {
    assertValidTemplateCode(data.templateCode);
  }
  if (data.monthlyFilingDueDay !== undefined && data.monthlyFilingDueDay !== null) {
    const d = data.monthlyFilingDueDay;
    if (!Number.isInteger(d) || d < 1 || d > 28) {
      throw new Error("Monthly due day must be between 1 and 28, or leave empty for end-of-month.");
    }
  }
  let fieldsPayload: Prisma.InputJsonValue | undefined;
  if (data.fields !== undefined) {
    const parsed = parseAuditTemplateFields(data.fields);
    if (!parsed.ok) throw new Error(`Invalid template fields: ${parsed.error}`);
    fieldsPayload = sanitizeJsonForAuditStorage(parsed.fields) as Prisma.InputJsonValue;
  }
  const shouldBumpVersion =
    data.name !== undefined ||
    data.description !== undefined ||
    data.category !== undefined ||
    data.assignmentScope !== undefined ||
    data.fields !== undefined ||
    data.aiAssistantPrompt !== undefined ||
    data.templateCode !== undefined ||
    data.filingFrequency !== undefined ||
    data.monthlyFilingDueDay !== undefined;

  const beforeRow = await prisma.auditFormTemplate.findUnique({ where: { id } });
  if (!beforeRow) throw new Error("Template not found");
  const beforeSnap = toTemplateSnapshot(beforeRow);

  const mergedSnap: AuditTemplateSnapshot = {
    name: data.name !== undefined ? data.name.trim() : beforeSnap.name,
    description: data.description !== undefined ? data.description : beforeSnap.description,
    category: data.category !== undefined ? data.category : beforeSnap.category,
    assignmentScope: data.assignmentScope !== undefined ? data.assignmentScope : beforeSnap.assignmentScope,
    templateCode:
      data.templateCode !== undefined
        ? data.templateCode === null || data.templateCode === ""
          ? null
          : data.templateCode.trim()
        : beforeSnap.templateCode,
    aiAssistantPrompt:
      data.aiAssistantPrompt !== undefined
        ? data.aiAssistantPrompt === null
          ? null
          : data.aiAssistantPrompt.trim() || null
        : beforeSnap.aiAssistantPrompt,
    fields: fieldsPayload !== undefined ? fieldsPayload : beforeSnap.fields,
    filingFrequency: data.filingFrequency !== undefined ? data.filingFrequency : beforeSnap.filingFrequency,
    monthlyFilingDueDay:
      data.monthlyFilingDueDay !== undefined ? data.monthlyFilingDueDay : beforeSnap.monthlyFilingDueDay,
    isActive: data.isActive !== undefined ? data.isActive : beforeSnap.isActive,
  };

  const { summaryLine, changesJson } = buildAuditTemplateChangePayload(beforeSnap, mergedSnap);
  const shouldWriteLog = summaryLine !== "No material changes detected.";

  await prisma.$transaction(async (tx) => {
    await tx.auditFormTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.assignmentScope !== undefined && { assignmentScope: data.assignmentScope }),
        ...(fieldsPayload !== undefined && { fields: fieldsPayload }),
        ...(data.aiAssistantPrompt !== undefined && {
          aiAssistantPrompt: data.aiAssistantPrompt === null ? null : data.aiAssistantPrompt.trim() || null,
        }),
        ...(data.templateCode !== undefined && {
          templateCode: data.templateCode === null || data.templateCode === "" ? null : data.templateCode.trim(),
        }),
        ...(data.filingFrequency !== undefined && { filingFrequency: data.filingFrequency }),
        ...(data.monthlyFilingDueDay !== undefined && {
          monthlyFilingDueDay: data.monthlyFilingDueDay,
        }),
        ...(shouldBumpVersion && { version: { increment: 1 } }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    const afterRow = await tx.auditFormTemplate.findUniqueOrThrow({ where: { id } });
    await tx.propertyFormAssignment.updateMany({
      where: { formTemplateId: id },
      data: { assignedTemplateVersion: afterRow.version },
    });
    await tx.serviceUserFormAssignment.updateMany({
      where: { formTemplateId: id },
      data: { assignedTemplateVersion: afterRow.version },
    });

    if (shouldWriteLog) {
      await tx.auditFormTemplateChangeLog.create({
        data: {
          formTemplateId: id,
          changedById: editorId,
          versionAfter: afterRow.version,
          summaryLine,
          changesJson: changesJson as Prisma.InputJsonValue,
        },
      });
    }
  });

  revalidatePath(`/audits/templates/${id}`);
  revalidatePath("/audits/templates");
  revalidatePath("/audits/recording");
  revalidatePath("/audits/manager");
}

export async function toggleFormTemplateActive(id: string) {
  const session = await requireAdmin();
  const editorId = session.user?.id ?? null;
  const beforeRow = await prisma.auditFormTemplate.findUnique({ where: { id } });
  if (!beforeRow) throw new Error("Template not found");
  const beforeSnap = toTemplateSnapshot(beforeRow);
  await prisma.auditFormTemplate.update({ where: { id }, data: { isActive: !beforeRow.isActive } });
  const afterRow = await prisma.auditFormTemplate.findUniqueOrThrow({ where: { id } });
  const afterSnap = toTemplateSnapshot(afterRow);
  const { summaryLine, changesJson } = buildAuditTemplateChangePayload(beforeSnap, afterSnap);
  await prisma.auditFormTemplateChangeLog.create({
    data: {
      formTemplateId: id,
      changedById: editorId,
      versionAfter: afterRow.version,
      summaryLine,
      changesJson: changesJson as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/audits/templates");
  revalidatePath(`/audits/templates/${id}`);
  revalidatePath("/audits/manager");
}

export async function getPropertyFormAssignments(propertyId: string) {
  await requireAdmin();
  return prisma.propertyFormAssignment.findMany({
    where: { propertyId },
    include: {
      formTemplate: {
        select: {
          id: true,
          name: true,
          version: true,
          assignmentScope: true,
          basedOn: { select: { id: true, name: true, version: true } },
        },
      },
      assignedBaseTemplate: { select: { id: true, name: true, version: true } },
    },
    orderBy: { formTemplate: { name: "asc" } },
  });
}

export async function togglePropertyFormAssignment(propertyId: string, formTemplateId: string) {
  await requireAdmin();
  const template = await prisma.auditFormTemplate.findUnique({
    where: { id: formTemplateId },
    select: { version: true, basedOnTemplateId: true, assignmentScope: true },
  });
  if (!template) throw new Error("Template not found");
  if (template.assignmentScope === "GLOBAL") {
    throw new Error("Organisation-wide forms are not toggled per property — edit the template scope under Templates.");
  }
  if (template.assignmentScope === "SERVICE_USER") {
    throw new Error("Person-only forms are assigned per service user, not on the property list.");
  }
  if (template.assignmentScope === "CARE_PACKAGE") {
    throw new Error(
      "Care package forms follow each person’s care package — link templates under Audits → Care packages, not per property."
    );
  }
  const key = { propertyId_formTemplateId: { propertyId, formTemplateId } };
  const existing = await prisma.propertyFormAssignment.findUnique({ where: key });
  if (!existing) {
    await prisma.propertyFormAssignment.create({
      data: {
        propertyId,
        formTemplateId,
        isActive: true,
        assignedAt: new Date(),
        assignedTemplateVersion: template.version,
        assignedBaseTemplateId: template.basedOnTemplateId ?? null,
      },
    });
  } else {
    await prisma.propertyFormAssignment.update({
      where: key,
      data: {
        isActive: !existing.isActive,
        ...(!existing.isActive && {
          assignedAt: new Date(),
          assignedTemplateVersion: template.version,
          assignedBaseTemplateId: template.basedOnTemplateId ?? null,
        }),
      },
    });
  }
  revalidatePath(`/audits/property/${propertyId}`);
  revalidatePath("/audits/manager");
}

export async function bulkAssignAllTemplates(propertyId: string) {
  await requireAdmin();
  const templates = await prisma.auditFormTemplate.findMany({
    where: { isActive: true, assignmentScope: "PROPERTY" },
    select: { id: true, version: true, basedOnTemplateId: true },
  });
  await prisma.$transaction(
    templates.map((t) =>
      prisma.propertyFormAssignment.upsert({
        where: { propertyId_formTemplateId: { propertyId, formTemplateId: t.id } },
        update: {
          isActive: true,
          assignedAt: new Date(),
          assignedTemplateVersion: t.version,
          assignedBaseTemplateId: t.basedOnTemplateId ?? null,
        },
        create: {
          propertyId,
          formTemplateId: t.id,
          isActive: true,
          assignedAt: new Date(),
          assignedTemplateVersion: t.version,
          assignedBaseTemplateId: t.basedOnTemplateId ?? null,
        },
      })
    )
  );
  revalidatePath(`/audits/property/${propertyId}`);
  revalidatePath("/audits/manager");
}

export async function getPropertyServiceUsers(propertyId: string) {
  await requireAdmin();
  return prisma.serviceUser.findMany({
    where: { propertyId },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      carePackageId: true,
      carePackage: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getServiceUserFormAssignments(serviceUserId: string) {
  await requireAdmin();
  return prisma.serviceUserFormAssignment.findMany({
    where: { serviceUserId },
    include: {
      formTemplate: {
        select: {
          id: true,
          name: true,
          version: true,
          assignmentScope: true,
          basedOn: { select: { id: true, name: true, version: true } },
        },
      },
      assignedBaseTemplate: { select: { id: true, name: true, version: true } },
    },
    orderBy: { formTemplate: { name: "asc" } },
  });
}

export async function toggleServiceUserFormAssignment(serviceUserId: string, formTemplateId: string) {
  await requireAdmin();
  const template = await prisma.auditFormTemplate.findUnique({
    where: { id: formTemplateId },
    select: { version: true, basedOnTemplateId: true, assignmentScope: true },
  });
  if (!template) throw new Error("Template not found");
  if (template.assignmentScope === "GLOBAL") {
    throw new Error("Organisation-wide forms apply to everyone already — change scope under Templates if needed.");
  }
  if (template.assignmentScope === "CARE_PACKAGE") {
    throw new Error(
      "Care package forms are driven by the service user’s care package. Exclude per person on the property page if needed."
    );
  }

  const key = { serviceUserId_formTemplateId: { serviceUserId, formTemplateId } };
  const existing = await prisma.serviceUserFormAssignment.findUnique({ where: key });
  if (!existing) {
    await prisma.serviceUserFormAssignment.create({
      data: {
        serviceUserId,
        formTemplateId,
        isActive: true,
        assignedAt: new Date(),
        assignedTemplateVersion: template.version,
        assignedBaseTemplateId: template.basedOnTemplateId ?? null,
      },
    });
  } else {
    await prisma.serviceUserFormAssignment.update({
      where: key,
      data: {
        isActive: !existing.isActive,
        ...(!existing.isActive && {
          assignedAt: new Date(),
          assignedTemplateVersion: template.version,
          assignedBaseTemplateId: template.basedOnTemplateId ?? null,
        }),
      },
    });
  }

  const su = await prisma.serviceUser.findUnique({ where: { id: serviceUserId }, select: { propertyId: true } });
  if (su?.propertyId) {
    revalidatePath(`/audits/property/${su.propertyId}`);
    revalidatePath(`/audits/property/${su.propertyId}/service-users`);
  }
  revalidatePath("/audits/manager");
}

/** Opt out of a property- or care-package–scoped form for one service user (row with isActive false). */
export async function setPropertyTemplateOptOutForServiceUser(
  serviceUserId: string,
  formTemplateId: string,
  excluded: boolean
) {
  await requireAdmin();
  const template = await prisma.auditFormTemplate.findUnique({
    where: { id: formTemplateId },
    select: { assignmentScope: true, version: true, basedOnTemplateId: true },
  });
  if (!template) throw new Error("Template not found");
  if (template.assignmentScope !== "PROPERTY" && template.assignmentScope !== "CARE_PACKAGE") {
    throw new Error("Only property-wide or care-package–scoped forms can be excluded per person here.");
  }
  const key = { serviceUserId_formTemplateId: { serviceUserId, formTemplateId } };
  if (!excluded) {
    await prisma.serviceUserFormAssignment.deleteMany({ where: { serviceUserId, formTemplateId } });
  } else {
    await prisma.serviceUserFormAssignment.upsert({
      where: key,
      create: {
        serviceUserId,
        formTemplateId,
        isActive: false,
        assignedAt: new Date(),
        assignedTemplateVersion: template.version,
        assignedBaseTemplateId: template.basedOnTemplateId ?? null,
      },
      update: { isActive: false },
    });
  }
  const su = await prisma.serviceUser.findUnique({ where: { id: serviceUserId }, select: { propertyId: true } });
  if (su?.propertyId) {
    revalidatePath(`/audits/property/${su.propertyId}`);
  }
  revalidatePath("/audits/manager");
}

/** Assign or remove a person-only (SERVICE_USER scoped) form for one service user. */
export async function setServiceUserPersonalTemplateActive(
  serviceUserId: string,
  formTemplateId: string,
  active: boolean
) {
  await requireAdmin();
  const template = await prisma.auditFormTemplate.findUnique({
    where: { id: formTemplateId },
    select: { assignmentScope: true, version: true, basedOnTemplateId: true },
  });
  if (!template) throw new Error("Template not found");
  if (template.assignmentScope !== "SERVICE_USER") {
    throw new Error("Only person-only forms can be toggled here.");
  }
  const key = { serviceUserId_formTemplateId: { serviceUserId, formTemplateId } };
  if (!active) {
    await prisma.serviceUserFormAssignment.deleteMany({ where: { serviceUserId, formTemplateId } });
  } else {
    await prisma.serviceUserFormAssignment.upsert({
      where: key,
      create: {
        serviceUserId,
        formTemplateId,
        isActive: true,
        assignedAt: new Date(),
        assignedTemplateVersion: template.version,
        assignedBaseTemplateId: template.basedOnTemplateId ?? null,
      },
      update: {
        isActive: true,
        assignedAt: new Date(),
        assignedTemplateVersion: template.version,
        assignedBaseTemplateId: template.basedOnTemplateId ?? null,
      },
    });
  }
  const su = await prisma.serviceUser.findUnique({ where: { id: serviceUserId }, select: { propertyId: true } });
  if (su?.propertyId) {
    revalidatePath(`/audits/property/${su.propertyId}`);
  }
  revalidatePath("/audits/manager");
}

export async function getFormSubmissions(filters: {
  propertyId?: string;
  templateId?: string;
  status?: AuditSubmissionStatus;
  limit?: number;
}) {
  await requireAdmin();
  return prisma.auditFormSubmission.findMany({
    where: {
      ...(filters.propertyId && { propertyId: filters.propertyId }),
      ...(filters.templateId && { formTemplateId: filters.templateId }),
      ...(filters.status && { status: filters.status }),
    },
    include: {
      formTemplate: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
      serviceUser: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 100,
  });
}

export async function getFormSubmission(id: string) {
  await requireAdmin();
  return prisma.auditFormSubmission.findUnique({
    where: { id },
    include: { formTemplate: true, property: true, serviceUser: true },
  });
}

/** Admin or the staff member who submitted — for “All reports” / worker view. */
export async function getFormSubmissionForViewer(id: string) {
  const session = await requireAuthenticatedUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  const role = (session.user as { role?: string }).role;
  const submission = await prisma.auditFormSubmission.findUnique({
    where: { id },
    include: {
      formTemplate: true,
      property: true,
      serviceUser: true,
      submittedBy: { select: { id: true, name: true } },
    },
  });
  if (!submission) return null;
  if (role !== "ADMIN" && submission.submittedById !== userId) return null;
  return submission;
}

/** Recent audit reports filed for a service user (patient record timeline). */
export async function getAuditSubmissionsForServiceUser(serviceUserId: string, limit = 25) {
  const session = await requireAuthenticatedUser();
  if (!session.user?.id) return [];
  return prisma.auditFormSubmission.findMany({
    where: { serviceUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      formTemplate: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
      submittedBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Care worker dashboard: audit forms assigned to today&apos;s venue(s) for people on their shifts.
 * Twice-daily templates (e.g. BP diary) expect up to two SUBMITTED filings per UK calendar day.
 */
export async function getWorkerDashboardAuditReminders(userId: string): Promise<WorkerAuditReminderItem[]> {
  await requireAuthenticatedUser();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const shifts = await prisma.shift.findMany({
    where: {
      careWorkerId: userId,
      startAt: { lte: todayEnd },
      endAt: { gte: todayStart },
      status: { not: "CANCELLED" },
    },
    include: {
      serviceUser: { select: { id: true, name: true, propertyId: true } },
      property: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const propertyIds = new Set<string>();
  for (const s of shifts) {
    const pid = s.propertyId ?? s.serviceUser.propertyId;
    if (pid) propertyIds.add(pid);
  }
  if (propertyIds.size === 0) return [];

  const patientIds = Array.from(new Set(shifts.map((s) => s.serviceUserId)));

  const [globals, propertyAssignments, suAssignments, carePackageBySu] = await Promise.all([
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "GLOBAL" },
      select: { id: true, name: true, fields: true },
    }),
    prisma.propertyFormAssignment.findMany({
      where: { propertyId: { in: Array.from(propertyIds) }, isActive: true },
      include: {
        property: { select: { id: true, name: true } },
        formTemplate: {
          select: {
            id: true,
            name: true,
            fields: true,
            isActive: true,
            assignmentScope: true,
          },
        },
      },
    }),
    prisma.serviceUserFormAssignment.findMany({
      where: { serviceUserId: { in: patientIds } },
      include: {
        formTemplate: {
          select: {
            id: true,
            name: true,
            fields: true,
            isActive: true,
            assignmentScope: true,
          },
        },
      },
    }),
    loadCarePackageTemplatesByServiceUserId(patientIds),
  ]);

  const propertyRows = propertyAssignments
    .filter((a) => a.formTemplate.isActive && a.formTemplate.assignmentScope === "PROPERTY")
    .map((a) => ({
      propertyId: a.propertyId,
      formTemplate: a.formTemplate,
    }));

  const allEffectiveIds = new Set<string>();
  for (const s of shifts) {
    const propId = s.propertyId ?? s.serviceUser.propertyId;
    if (!propId) continue;
    const eff = mergeEffectiveAuditTemplates(
      propId,
      s.serviceUserId,
      globals,
      propertyRows,
      suAssignments,
      carePackageBySu.get(s.serviceUserId) ?? []
    );
    for (const t of eff) allEffectiveIds.add(t.id);
  }
  if (allEffectiveIds.size === 0) return [];

  const recentSubs = await prisma.auditFormSubmission.findMany({
    where: {
      serviceUserId: { in: patientIds },
      formTemplateId: { in: Array.from(allEffectiveIds) },
      status: "SUBMITTED",
      createdAt: { gte: new Date(Date.now() - 40 * 60 * 60 * 1000) },
    },
    select: { serviceUserId: true, formTemplateId: true, createdAt: true },
  });

  const items: WorkerAuditReminderItem[] = [];
  const seen = new Set<string>();
  const now = new Date();

  for (const shift of shifts) {
    const propId = shift.propertyId ?? shift.serviceUser.propertyId;
    if (!propId) continue;
    const propName =
      shift.property?.name ??
      propertyAssignments.find((x) => x.propertyId === propId)?.property.name ??
      "Venue";
    const windowLabel = `${format(shift.startAt, "HH:mm")}–${format(shift.endAt, "HH:mm")}`;

    const effectiveTemplates = mergeEffectiveAuditTemplates(
      propId,
      shift.serviceUserId,
      globals,
      propertyRows,
      suAssignments,
      carePackageBySu.get(shift.serviceUserId) ?? []
    );

    for (const t of effectiveTemplates) {
      const dk = `${shift.serviceUserId}:${t.id}`;
      if (seen.has(dk)) continue;

      const twice = auditTemplateLooksTwiceDaily(t.name, t.fields);
      const needed = twice ? 2 : 1;
      const have = countSubmissionsTodayLondon(recentSubs, shift.serviceUserId, t.id, now);
      if (have >= needed) continue;

      seen.add(dk);
      const openPath = `/audits/submit/${t.id}?propertyId=${encodeURIComponent(propId)}&serviceUserId=${encodeURIComponent(shift.serviceUserId)}`;
      const periodHint = twice
        ? have === 0
          ? "Submit morning and evening readings today (two filings for AM and PM, unless policy says otherwise)."
          : "One filing today — add the other period (AM or PM) if still due."
        : "Complete this audit for the person on your shift.";

      items.push({
        id: dk,
        templateId: t.id,
        templateName: t.name,
        propertyId: propId,
        propertyName: propName,
        serviceUserId: shift.serviceUserId,
        serviceUserName: shift.serviceUser.name,
        shiftWindowLabel: windowLabel,
        message: periodHint,
        neededToday: needed,
        haveToday: have,
        openPath,
      });
    }
  }

  return items;
}

export async function createFormSubmission(data: {
  formTemplateId: string;
  propertyId: string;
  serviceUserId?: string | null;
  payload: Prisma.InputJsonValue;
  status?: AuditSubmissionStatus;
}) {
  const session = await requireAuthenticatedUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  const role = (session.user as { role?: string }).role;
  const userName = session.user?.name?.trim() || null;
  const userEmail = session.user?.email?.trim() || null;

  const visible = await getPropertiesVisibleForAuditRecording(userId, role);
  if (!visible.some((p) => p.id === data.propertyId)) {
    throw new Error("You cannot submit reports for this property. Choose a venue from the recording page.");
  }

  const template = await prisma.auditFormTemplate.findFirst({
    where: { id: data.formTemplateId, isActive: true },
    select: { id: true, name: true, fields: true },
  });
  if (!template) {
    throw new Error("This form template is not available. Go back and open the form again.");
  }

  const linkedPatientId = data.serviceUserId?.trim() || null;
  let serviceUserDob: Date | null = null;
  if (linkedPatientId) {
    const su = await prisma.serviceUser.findFirst({
      where: { id: linkedPatientId, propertyId: data.propertyId },
      select: { id: true, dateOfBirth: true },
    });
    if (!su) {
      throw new Error(
        "This patient is not on the list for this venue. Go back to Form recording and select a patient from the dropdown."
      );
    }
    serviceUserDob = su.dateOfBirth;
  }

  const raw = data.payload;
  const obj: Record<string, unknown> =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : { formData: raw };
  const existing = obj.__recording;
  const savedAtIso = new Date().toISOString();
  obj.__recording = {
    ...(typeof existing === "object" && existing !== null ? (existing as Record<string, unknown>) : {}),
    serverReceivedAt: savedAtIso,
    submittedById: userId,
    submittedByName: userName,
    submittedByEmail: userEmail,
    savedToPatientId: linkedPatientId,
  };

  const ageYears = resolveAgeYearsForAuditSubmission({
    serviceUserDob,
    payloadValues: stripAuditSubmissionMeta(obj),
  });
  const submissionBlocking = getAllSubmissionBlockingIssues(
    template.name,
    template.fields,
    obj,
    ageYears
  );
  if (submissionBlocking.length > 0) {
    throw new Error(
      "The report cannot be saved until these are fixed:\n\n" +
        submissionBlocking.map((s) => `• ${s}`).join("\n")
    );
  }

  const dataJson = sanitizeJsonForAuditStorage(obj);

  try {
    const submission = await prisma.auditFormSubmission.create({
      data: {
        formTemplateId: data.formTemplateId,
        propertyId: data.propertyId,
        serviceUserId: linkedPatientId,
        data: dataJson,
        submittedById: userId,
        status: data.status ?? "SUBMITTED",
      },
    });
    revalidatePath(`/audits/property/${data.propertyId}`);
    revalidatePath("/audits/manager");
    revalidatePath("/audits/recording");
    revalidatePath(`/audits/submit/${data.formTemplateId}`);
    return submission;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Foreign key constraint failed/i.test(msg) || /violates foreign key constraint/i.test(msg)) {
      throw new Error(
        "Save failed: form, venue, or patient link is invalid. Refresh the page and try again, or pick the patient from the list."
      );
    }
    throw err;
  }
}

export async function reviewFormSubmission(id: string, reviewNotes?: string) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  const submission = await prisma.auditFormSubmission.update({
    where: { id },
    data: { status: "REVIEWED", reviewedById: userId, reviewedAt: new Date(), reviewNotes: reviewNotes?.trim() || null },
  });
  revalidatePath(`/audits/submissions/${id}`);
  revalidatePath(`/audits/property/${submission.propertyId}`);
}

export async function updateFormSubmission(id: string, data: Prisma.InputJsonValue, status?: AuditSubmissionStatus) {
  await requireAdmin();
  const submission = await prisma.auditFormSubmission.update({
    where: { id },
    data: { data, ...(status && { status }) },
  });
  revalidatePath(`/audits/submissions/${id}`);
  revalidatePath(`/audits/property/${submission.propertyId}`);
  revalidatePath("/audits/manager");
}

export async function createCqcAssessment(data: {
  propertyId: string;
  assessmentDate: Date;
  notes?: string;
  scores: { keyQuestion: CqcKeyQuestion; subArea: string; score: number; findings?: string; actionsRequired?: string }[];
}) {
  const session = await requireAdmin();
  const assessorId = session.user?.id;
  if (!assessorId) throw new Error("Missing user id");
  const total = data.scores.reduce((sum, s) => sum + s.score, 0);
  const percent = Math.round((total / (Math.max(data.scores.length, 1) * 4)) * 100);
  const overallRating = getCqcRatingFromPercent(percent) as CqcRating;
  const result = await prisma.auditCqcAssessment.create({
    data: {
      propertyId: data.propertyId,
      assessmentDate: data.assessmentDate,
      notes: data.notes?.trim() || null,
      assessorId,
      overallRating,
      scores: {
        create: data.scores.map((s) => ({
          keyQuestion: s.keyQuestion,
          subArea: s.subArea,
          score: Math.max(1, Math.min(4, s.score)),
          findings: s.findings?.trim() || null,
          actionsRequired: s.actionsRequired?.trim() || null,
        })),
      },
    },
  });
  revalidatePath(`/audits/cqc/${data.propertyId}`);
  return result;
}

export async function getCqcAssessments(propertyId?: string) {
  await requireAdmin();
  return prisma.auditCqcAssessment.findMany({
    where: { ...(propertyId && { propertyId }) },
    include: { property: { select: { id: true, name: true } }, assessor: { select: { id: true, name: true } } },
    orderBy: { assessmentDate: "desc" },
  });
}

export async function getCqcAssessment(id: string) {
  await requireAdmin();
  return prisma.auditCqcAssessment.findUnique({
    where: { id },
    include: { scores: true, property: { select: { id: true, name: true } }, assessor: { select: { id: true, name: true } } },
  });
}

export async function updateCqcScore(
  scoreId: string,
  data: Partial<{ score: number; findings: string | null; actionsRequired: string | null }>
) {
  await requireAdmin();
  await prisma.auditCqcScore.update({
    where: { id: scoreId },
    data: {
      ...(data.score !== undefined && { score: Math.max(1, Math.min(4, data.score)) }),
      ...(data.findings !== undefined && { findings: data.findings }),
      ...(data.actionsRequired !== undefined && { actionsRequired: data.actionsRequired }),
    },
  });
}

export async function getAuditActions(filters: {
  propertyId?: string;
  status?: AuditActionStatus;
  priority?: AuditActionPriority;
  source?: string;
}) {
  await requireAdmin();
  return prisma.auditAction.findMany({
    where: {
      ...(filters.propertyId && { propertyId: filters.propertyId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.source && { source: filters.source }),
    },
    include: { property: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
}

export async function createAuditAction(data: {
  propertyId: string;
  description: string;
  dueDate: Date;
  priority?: AuditActionPriority;
  assignedToId?: string | null;
  source?: string;
  incidentId?: string | null;
  riskEntryId?: string | null;
}) {
  await requireAdmin();
  await prisma.auditAction.create({
    data: {
      propertyId: data.propertyId,
      description: data.description.trim(),
      dueDate: data.dueDate,
      priority: data.priority ?? "MEDIUM",
      assignedToId: data.assignedToId ?? null,
      source: data.source ?? "MANUAL",
      incidentId: data.incidentId ?? null,
      riskEntryId: data.riskEntryId ?? null,
    },
  });
  revalidatePath("/audits/actions");
}

export async function updateAuditAction(
  id: string,
  data: Partial<{ status: AuditActionStatus; priority: AuditActionPriority; assignedToId: string | null; dueDate: Date }>
) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  await prisma.auditAction.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.status === "DONE" && { completedAt: new Date(), completedById: userId }),
      ...(data.status && data.status !== "DONE" && { completedAt: null, completedById: null }),
    },
  });
  revalidatePath("/audits/actions");
}

export async function getRiskEntries(filters: { propertyId?: string; status?: string; limit?: number }) {
  await requireAdmin();
  return prisma.riskRegisterEntry.findMany({
    where: {
      ...(filters.propertyId && { propertyId: filters.propertyId }),
      ...(filters.status && { status: filters.status as never }),
    },
    include: {
      property: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      incidentLinks: { include: { incident: true } },
    },
    orderBy: [{ status: "asc" }, { riskScore: "desc" }],
    take: filters.limit ?? 200,
  });
}

export async function getRiskEntry(id: string) {
  await requireAdmin();
  return prisma.riskRegisterEntry.findUnique({
    where: { id },
    include: { incidentLinks: { include: { incident: true } }, owner: { select: { id: true, name: true } } },
  });
}

export async function createRiskEntry(data: {
  propertyId: string;
  title: string;
  category: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  description?: string;
  ownerId?: string | null;
  reviewDate?: Date | null;
}) {
  await requireAdmin();
  await prisma.riskRegisterEntry.create({
    data: {
      propertyId: data.propertyId,
      title: data.title.trim(),
      category: data.category,
      likelihood: data.likelihood,
      impact: data.impact,
      riskScore: (data.likelihood === "RARE" ? 1 : data.likelihood === "UNLIKELY" ? 2 : data.likelihood === "POSSIBLE" ? 3 : data.likelihood === "LIKELY" ? 4 : 5) *
        (data.impact === "NEGLIGIBLE" ? 1 : data.impact === "MINOR" ? 2 : data.impact === "MODERATE" ? 3 : data.impact === "MAJOR" ? 4 : 5),
      description: data.description?.trim() || null,
      ownerId: data.ownerId ?? null,
      reviewDate: data.reviewDate ?? null,
    },
  });
  revalidatePath("/audits/risks");
}

export async function updateRiskEntry(
  id: string,
  data: Partial<{ title: string; status: RiskStatus; category: string; likelihood: RiskLikelihood; impact: RiskImpact }>
) {
  await requireAdmin();
  await prisma.riskRegisterEntry.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.likelihood !== undefined && { likelihood: data.likelihood }),
      ...(data.impact !== undefined && { impact: data.impact }),
    },
  });
  revalidatePath("/audits/risks");
}

export async function linkRiskToIncident(riskEntryId: string, incidentId: string, notes?: string) {
  await requireAdmin();
  await prisma.riskIncidentLink.upsert({
    where: { riskEntryId_incidentId: { riskEntryId, incidentId } },
    update: { notes: notes?.trim() || null },
    create: { riskEntryId, incidentId, notes: notes?.trim() || null },
  });
  revalidatePath("/audits/risks");
}

export async function unlinkRiskFromIncident(riskEntryId: string, incidentId: string) {
  await requireAdmin();
  await prisma.riskIncidentLink.delete({ where: { riskEntryId_incidentId: { riskEntryId, incidentId } } });
  revalidatePath("/audits/risks");
}

export async function getRiskMatrixData(propertyId?: string) {
  await requireAdmin();
  const rows = await prisma.riskRegisterEntry.findMany({
    where: { ...(propertyId && { propertyId }) },
    select: { likelihood: true, impact: true },
  });
  const matrix: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.likelihood}:${row.impact}`;
    matrix[key] = (matrix[key] ?? 0) + 1;
  }
  return { matrix };
}

export async function getRiskTrends(propertyId?: string, months = 12) {
  await requireAdmin();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return prisma.riskRegisterEntry.findMany({
    where: { createdAt: { gte: start }, ...(propertyId && { propertyId }) },
    select: { createdAt: true, riskScore: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getComplianceDocs(filters: { propertyId?: string; category?: string }) {
  await requireAdmin();
  return prisma.complianceDocument.findMany({
    where: {
      ...(filters.propertyId && { propertyId: filters.propertyId }),
      ...(filters.category && { category: filters.category }),
    },
    include: { readReceipts: true, uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createComplianceDoc(data: {
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  expiresAt?: Date | null;
}) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  await prisma.complianceDocument.create({
    data: {
      title: data.title.trim(),
      category: data.category,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      expiresAt: data.expiresAt ?? null,
      uploadedById: userId,
    },
  });
  revalidatePath("/audits/compliance");
}

export async function updateComplianceDoc(id: string, data: Partial<{ title: string; category: string; expiresAt: Date | null }>) {
  await requireAdmin();
  await prisma.complianceDocument.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
    },
  });
  revalidatePath("/audits/compliance");
}

export async function deleteComplianceDoc(id: string) {
  await requireAdmin();
  await prisma.complianceDocument.delete({ where: { id } });
  revalidatePath("/audits/compliance");
}

export async function recordReadReceipt(documentId: string) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  await prisma.documentReadReceipt.upsert({
    where: { documentId_userId: { documentId, userId } },
    update: { readAt: new Date(), acknowledged: true },
    create: { documentId, userId, acknowledged: true },
  });
}

export async function getDocumentReadStatus(documentId: string) {
  await requireAdmin();
  return prisma.documentReadReceipt.findMany({
    where: { documentId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { readAt: "desc" },
  });
}

export async function getStaffReadReceipts(userId: string) {
  await requireAdmin();
  return prisma.documentReadReceipt.findMany({
    where: { userId },
    include: { document: { select: { id: true, title: true, category: true } } },
    orderBy: { readAt: "desc" },
  });
}

export async function getExpiringDocuments(withinDays = 60) {
  await requireAdmin();
  return prisma.complianceDocument.findMany({
    where: { expiresAt: { lte: new Date(Date.now() + withinDays * 86400000) }, isActive: true },
    orderBy: { expiresAt: "asc" },
  });
}

export async function getComplianceDashboardData() {
  await requireAdmin();
  const [total, expiring, users, docs, perProperty] = await Promise.all([
    prisma.complianceDocument.count({ where: { isActive: true } }),
    prisma.complianceDocument.count({ where: { expiresAt: { lte: new Date(Date.now() + 60 * 86400000) }, isActive: true } }),
    prisma.user.count({ where: { active: true, role: "CARE_WORKER" } }),
    prisma.complianceDocument.findMany({
      where: { isActive: true },
      include: { readReceipts: { select: { id: true } } },
    }),
    prisma.complianceDocument.groupBy({
      by: ["propertyId"],
      where: { isActive: true },
      _count: true,
    }),
  ]);
  const readRate =
    docs.length === 0 || users === 0
      ? 0
      : Math.round(
          (docs.reduce((sum, d) => sum + d.readReceipts.length, 0) / (docs.length * users)) * 100
        );
  return { total, expiring, readRate, perProperty };
}

export async function getTrainingRequirements() {
  await requireAdmin();
  return prisma.trainingRequirement.findMany({
    orderBy: { name: "asc" },
    include: { profileLinks: { select: { competencyProfileId: true } } },
  });
}

export async function createTrainingRequirement(data: {
  name: string;
  code?: string | null;
  category?: string | null;
  isMandatory?: boolean;
  renewalMonths?: number | null;
  appliesToAllStaff?: boolean;
}) {
  await requireAdmin();
  const code = data.code?.trim() ? data.code.trim() : null;
  await prisma.trainingRequirement.create({
    data: {
      name: data.name.trim(),
      code,
      category: data.category?.trim() || null,
      isMandatory: data.isMandatory ?? true,
      renewalMonths: data.renewalMonths ?? null,
      appliesToAllStaff: data.appliesToAllStaff ?? true,
    },
  });
  revalidatePath("/audits/workforce");
}

export async function updateTrainingRequirement(
  id: string,
  data: Partial<{
    name: string;
    code: string | null;
    category: string | null;
    isMandatory: boolean;
    renewalMonths: number | null;
    isActive: boolean;
    appliesToAllStaff: boolean;
  }>
) {
  await requireAdmin();
  await prisma.trainingRequirement.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.code !== undefined && {
        code: data.code === null || data.code === "" ? null : data.code.trim(),
      }),
      ...(data.category !== undefined && { category: data.category?.trim() || null }),
      ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
      ...(data.renewalMonths !== undefined && { renewalMonths: data.renewalMonths }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.appliesToAllStaff !== undefined && { appliesToAllStaff: data.appliesToAllStaff }),
    },
  });
  revalidatePath("/audits/workforce");
}

export async function getStaffTrainingRecords(userId?: string) {
  await requireAdmin();
  return prisma.staffTrainingRecord.findMany({
    where: { ...(userId && { userId }) },
    include: { requirement: true, user: { select: { id: true, name: true } } },
    orderBy: { completedAt: "desc" },
  });
}

export async function recordTrainingCompletion(data: {
  userId: string;
  requirementId: string;
  completedAt: Date;
  certificateRef?: string | null;
  notes?: string | null;
}) {
  await requireAdmin();
  const req = await prisma.trainingRequirement.findUnique({ where: { id: data.requirementId } });
  if (!req) throw new Error("Requirement not found");
  const expiresAt = computeExpiresAtForNewRecord(data.completedAt, req.renewalMonths ?? null);
  await prisma.staffTrainingRecord.create({
    data: {
      userId: data.userId,
      requirementId: data.requirementId,
      completedAt: data.completedAt,
      expiresAt,
      certificateRef: data.certificateRef?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
  revalidatePath("/audits/workforce");
  revalidatePath("/staff");
}

export async function getTrainingMatrix() {
  await requireAdmin();
  const [users, requirements, records] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CARE_WORKER", active: true },
      select: {
        id: true,
        name: true,
        competencyProfiles: {
          select: { competencyProfile: { select: { id: true, name: true, slug: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.trainingRequirement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        code: true,
        isMandatory: true,
        renewalMonths: true,
        appliesToAllStaff: true,
        profileLinks: { select: { competencyProfileId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.staffTrainingRecord.findMany({
      select: { userId: true, requirementId: true, completedAt: true, expiresAt: true },
    }),
  ]);

  const latest = indexLatestRecordsByUserRequirement(records);
  const now = new Date();
  const rows = users.map((u) => {
    const profileIds = u.competencyProfiles.map((c) => c.competencyProfile.id);
    const applicable = applicableRequirementIdsForUser(profileIds, requirements);
    const cells = requirements.map((req) => {
      if (!applicable.has(req.id)) {
        return {
          requirementId: req.id,
          applicable: false,
          status: "NOT_REQUIRED" as const,
          completedAt: null as string | null,
          expiresAt: null as string | null,
        };
      }
      const key = `${u.id}:${req.id}`;
      const rec = latest.get(key) ?? null;
      const resolved = resolveCompetencyStatus(rec, req.renewalMonths ?? null, now);
      return {
        requirementId: req.id,
        applicable: true,
        status: resolved.status,
        completedAt: resolved.completedAt?.toISOString() ?? null,
        expiresAt: resolved.expiresAt?.toISOString() ?? null,
      };
    });
    return {
      userId: u.id,
      name: u.name,
      profileNames: u.competencyProfiles.map((c) => c.competencyProfile.name),
      profileSlugs: u.competencyProfiles.map((c) => c.competencyProfile.slug),
      cells,
    };
  });

  return { requirementColumns: requirements, rows };
}

export async function getCompetencyProfiles() {
  await requireAdmin();
  return prisma.competencyProfile.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      requirements: {
        include: { requirement: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function createCompetencyProfile(data: {
  slug: string;
  name: string;
  description?: string | null;
}) {
  await requireAdmin();
  const slug = data.slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!slug) throw new Error("Profile slug is required (letters, numbers, underscores).");
  await prisma.competencyProfile.create({
    data: {
      slug,
      name: data.name.trim(),
      description: data.description?.trim() || null,
    },
  });
  revalidatePath("/audits/workforce");
}

export async function updateCompetencyProfile(
  id: string,
  data: Partial<{ name: string; description: string | null; sortOrder: number; isActive: boolean }>
) {
  await requireAdmin();
  await prisma.competencyProfile.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
  revalidatePath("/audits/workforce");
}

export async function setCompetencyProfileRequirements(competencyProfileId: string, requirementIds: string[]) {
  await requireAdmin();
  const unique = Array.from(new Set(requirementIds));
  await prisma.$transaction(async (tx) => {
    await tx.competencyProfileRequirement.deleteMany({ where: { competencyProfileId } });
    for (const requirementId of unique) {
      await tx.competencyProfileRequirement.create({
        data: { competencyProfileId, requirementId },
      });
    }
  });
  revalidatePath("/audits/workforce");
}

export async function getCarePackagesForCompetencyAdmin() {
  await requireAdmin();
  return prisma.carePackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      competencyProfiles: {
        include: { competencyProfile: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
}

export async function setCarePackageCompetencyProfiles(carePackageId: string, competencyProfileIds: string[]) {
  await requireAdmin();
  const unique = Array.from(new Set(competencyProfileIds));
  await prisma.$transaction(async (tx) => {
    await tx.carePackageCompetencyProfile.deleteMany({ where: { carePackageId } });
    for (const competencyProfileId of unique) {
      await tx.carePackageCompetencyProfile.create({
        data: { carePackageId, competencyProfileId },
      });
    }
  });
  revalidatePath("/audits/workforce");
  revalidatePath("/audits/care-packages");
}

/** Care worker: competency rows that apply to them (for dashboard + notifications). */
export async function getMyCompetencySummaryForWorker(userId: string) {
  const session = await requireAuthenticatedUser();
  if (session.user?.id !== userId) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "CARE_WORKER") {
    return {
      items: [] as Array<{
        requirementId: string;
        name: string;
        status: string;
        completedAt: string | null;
        expiresAt: string | null;
      }>,
      expiredCount: 0,
      expiringCount: 0,
      missingCount: 0,
    };
  }

  const [profiles, requirements, records] = await Promise.all([
    prisma.userCompetencyProfile.findMany({
      where: { userId },
      select: { competencyProfileId: true },
    }),
    prisma.trainingRequirement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        renewalMonths: true,
        appliesToAllStaff: true,
        profileLinks: { select: { competencyProfileId: true } },
      },
    }),
    prisma.staffTrainingRecord.findMany({
      where: { userId },
      select: { userId: true, requirementId: true, completedAt: true, expiresAt: true },
    }),
  ]);

  const profileIds = profiles.map((p) => p.competencyProfileId);
  const applicable = applicableRequirementIdsForUser(profileIds, requirements);
  const latest = indexLatestRecordsByUserRequirement(records);
  const now = new Date();
  const items: Array<{
    requirementId: string;
    name: string;
    status: string;
    completedAt: string | null;
    expiresAt: string | null;
  }> = [];
  let expiredCount = 0;
  let expiringCount = 0;
  let missingCount = 0;

  for (const req of requirements) {
    if (!applicable.has(req.id)) continue;
    const key = `${userId}:${req.id}`;
    const rec = latest.get(key) ?? null;
    const r = resolveCompetencyStatus(rec, req.renewalMonths ?? null, now);
    items.push({
      requirementId: req.id,
      name: req.name,
      status: r.status,
      completedAt: r.completedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    });
    if (r.status === "EXPIRED") expiredCount += 1;
    else if (r.status === "EXPIRING") expiringCount += 1;
    else if (r.status === "MISSING") missingCount += 1;
  }

  return { items, expiredCount, expiringCount, missingCount };
}

/** Idempotent unread notifications for expired / expiring applicable training. */
export async function ensureMyCompetencyNotifications(userId: string) {
  const session = await requireAuthenticatedUser();
  if (session.user?.id !== userId) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "CARE_WORKER") return { created: 0 };

  const summary = await getMyCompetencySummaryForWorker(userId);
  let created = 0;
  for (const item of summary.items) {
    if (item.status !== "EXPIRED" && item.status !== "EXPIRING") continue;
    const link = `${COMPETENCY_NOTIFICATION_LINK_PREFIX}${encodeURIComponent(item.requirementId)}`;
    const existing = await prisma.notification.findFirst({
      where: { userId, read: false, link },
    });
    if (existing) continue;
    const title =
      item.status === "EXPIRED"
        ? `Training expired: ${item.name}`
        : `Training renewal due soon: ${item.name}`;
    const message =
      item.status === "EXPIRED"
        ? "Arrange refresher training and ask your manager to update your record in Workforce compliance."
        : `Your training expires on ${item.expiresAt?.slice(0, 10) ?? "soon"}. Book your refresher before the deadline.`;
    await prisma.notification.create({
      data: { userId, title, message, link },
    });
    created += 1;
  }
  return { created };
}

/** Admin: one worker’s applicable competency rows (for staff edit CRM panel). */
export async function getStaffCompetencyDetailForAdmin(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "CARE_WORKER" },
    select: {
      id: true,
      name: true,
      competencyProfiles: {
        select: { competencyProfile: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!user) return null;

  const [requirements, records] = await Promise.all([
    prisma.trainingRequirement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        renewalMonths: true,
        appliesToAllStaff: true,
        profileLinks: { select: { competencyProfileId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.staffTrainingRecord.findMany({
      where: { userId },
      select: { userId: true, requirementId: true, completedAt: true, expiresAt: true },
    }),
  ]);

  const profileIds = user.competencyProfiles.map((c) => c.competencyProfile.id);
  const applicable = applicableRequirementIdsForUser(profileIds, requirements);
  const latest = indexLatestRecordsByUserRequirement(records);
  const now = new Date();
  const items: Array<{
    requirementId: string;
    name: string;
    status: string;
    completedAt: string | null;
    expiresAt: string | null;
  }> = [];

  for (const req of requirements) {
    if (!applicable.has(req.id)) continue;
    const key = `${userId}:${req.id}`;
    const rec = latest.get(key) ?? null;
    const r = resolveCompetencyStatus(rec, req.renewalMonths ?? null, now);
    items.push({
      requirementId: req.id,
      name: req.name,
      status: r.status,
      completedAt: r.completedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    });
  }

  return {
    userName: user.name,
    profileNames: user.competencyProfiles.map((c) => c.competencyProfile.name),
    items,
  };
}

export async function getStaffDocuments(userId?: string) {
  await requireAdmin();
  return prisma.staffDocumentTracker.findMany({
    where: { ...(userId && { userId }) },
    include: { user: { select: { id: true, name: true } }, verifiedBy: { select: { id: true, name: true } } },
    orderBy: { expiresAt: "asc" },
  });
}

export async function createStaffDocument(data: { userId: string; documentType: string; expiresAt?: Date | null }) {
  await requireAdmin();
  await prisma.staffDocumentTracker.create({
    data: { userId: data.userId, documentType: data.documentType, expiresAt: data.expiresAt ?? null },
  });
  revalidatePath("/audits/workforce");
}

export async function updateStaffDocument(id: string, data: Partial<{ expiresAt: Date | null; documentRef: string | null }>) {
  await requireAdmin();
  await prisma.staffDocumentTracker.update({ where: { id }, data });
  revalidatePath("/audits/workforce");
}

export async function verifyStaffDocument(id: string) {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) throw new Error("Missing user id");
  await prisma.staffDocumentTracker.update({
    where: { id },
    data: { verified: true, verifiedAt: new Date(), verifiedById: userId },
  });
  revalidatePath("/audits/workforce");
}

export async function getSupervisionSchedules() {
  await requireAdmin();
  return prisma.supervisionSchedule.findMany({
    include: { staff: { select: { id: true, name: true } }, supervisor: { select: { id: true, name: true } } },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function createSupervisionSchedule(data: {
  staffId: string;
  supervisorId?: string | null;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  nextDueDate: Date;
}) {
  await requireAdmin();
  await prisma.supervisionSchedule.create({
    data: {
      staffId: data.staffId,
      supervisorId: data.supervisorId ?? null,
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
    },
  });
  revalidatePath("/audits/workforce");
}

export async function completeSupervision(id: string) {
  await requireAdmin();
  await prisma.supervisionSchedule.update({
    where: { id },
    data: { lastCompletedAt: new Date() },
  });
  revalidatePath("/audits/workforce");
}

export async function getWorkforceComplianceData() {
  await requireAdmin();
  const [userCount, requirementCount, recordCount, expiringDocs, overdueSupervisions, workers, requirements, records] =
    await Promise.all([
      prisma.user.count({ where: { role: "CARE_WORKER", active: true } }),
      prisma.trainingRequirement.count({ where: { isActive: true } }),
      prisma.staffTrainingRecord.count(),
      prisma.staffDocumentTracker.count({ where: { expiresAt: { lte: new Date(Date.now() + 60 * 86400000) } } }),
      prisma.supervisionSchedule.count({ where: { nextDueDate: { lt: new Date() }, isActive: true } }),
      prisma.user.findMany({
        where: { role: "CARE_WORKER", active: true },
        select: {
          id: true,
          competencyProfiles: { select: { competencyProfileId: true } },
        },
      }),
      prisma.trainingRequirement.findMany({
        where: { isActive: true },
        select: {
          id: true,
          renewalMonths: true,
          appliesToAllStaff: true,
          profileLinks: { select: { competencyProfileId: true } },
        },
      }),
      prisma.staffTrainingRecord.findMany({
        select: { userId: true, requirementId: true, completedAt: true, expiresAt: true },
      }),
    ]);

  const tallyUsers = workers.map((w) => ({
    id: w.id,
    profileIds: w.competencyProfiles.map((c) => c.competencyProfileId),
  }));
  const { expired, expiring, missing, applicableCellCount } = tallyOrgCompetencyGaps(
    tallyUsers,
    requirements,
    records
  );

  return {
    users: userCount,
    requirements: requirementCount,
    records: recordCount,
    expiringDocs,
    overdueSupervisions,
    competencyExpired: expired,
    competencyExpiring: expiring,
    competencyMissing: missing,
    competencyApplicableCells: applicableCellCount,
  };
}

export async function getExpiringStaffDocuments(withinDays = 60) {
  await requireAdmin();
  return prisma.staffDocumentTracker.findMany({
    where: { expiresAt: { lte: new Date(Date.now() + withinDays * 86400000) } },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { expiresAt: "asc" },
  });
}

export async function getAuditSchedules(propertyId: string) {
  await requireAdmin();
  return prisma.auditSchedule.findMany({
    where: { propertyId },
    include: { formTemplate: { select: { id: true, name: true } } },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function createAuditSchedule(data: {
  propertyId: string;
  title: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
  nextDueDate: Date;
  formTemplateId?: string | null;
}) {
  await requireAdmin();
  await prisma.auditSchedule.create({
    data: {
      propertyId: data.propertyId,
      title: data.title.trim(),
      frequency: data.frequency,
      nextDueDate: data.nextDueDate,
      formTemplateId: data.formTemplateId ?? null,
    },
  });
  revalidatePath(`/audits/property/${data.propertyId}`);
}

export async function updateAuditSchedule(
  id: string,
  data: Partial<{ title: string; frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL"; nextDueDate: Date; isActive: boolean }>
) {
  await requireAdmin();
  await prisma.auditSchedule.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.nextDueDate !== undefined && { nextDueDate: data.nextDueDate }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function exportAuditReportCsv(propertyId: string) {
  await requireAdmin();
  const [submissions, actions, risks] = await Promise.all([
    prisma.auditFormSubmission.count({ where: { propertyId } }),
    prisma.auditAction.count({ where: { propertyId } }),
    prisma.riskRegisterEntry.count({ where: { propertyId } }),
  ]);
  return ["metric,value", `submissions,${submissions}`, `actions,${actions}`, `risks,${risks}`].join("\n");
}

export async function exportSubmissionsCsv(filters: { propertyId?: string; templateId?: string; status?: AuditSubmissionStatus }) {
  await requireAdmin();
  const rows = await getFormSubmissions({
    propertyId: filters.propertyId,
    templateId: filters.templateId,
    status: filters.status,
    limit: 10000,
  });
  return [
    "id,template,property,service_user,status,submitted_by,created_at",
    ...rows.map((r) =>
      [r.id, csv(r.formTemplate.name), csv(r.property.name), csv(r.serviceUser?.name ?? ""), r.status, csv(r.submittedBy.name), r.createdAt.toISOString()].join(",")
    ),
  ].join("\\n");
}

function csv(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
