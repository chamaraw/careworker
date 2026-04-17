"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AuditScheduleFrequency } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";
import { computeTemplateComplianceStatus, type TemplateComplianceStatus } from "@/lib/audit-template-compliance-due";
import { MANAGER_FILING_WINDOW_DAYS } from "./manager-constants";
import { timeRecordCoreSelect } from "@/lib/time-record-core-select";
import { timeRecordHasRosterExceptionColumns } from "@/lib/time-record-extra-columns";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if ((session.user as { role?: string }).role !== "ADMIN") throw new Error("Admin only");
  return session;
}

const FILING_STATUSES = ["SUBMITTED", "REVIEWED"] as const;

export type ManagerPropertySummary = {
  propertyId: string;
  propertyName: string;
  totalAssignedTemplates: number;
  filedInPeriodCount: number;
  missingInPeriodCount: number;
  overdueScheduledCount: number;
  openActionsCount: number;
  serviceUserCount: number;
  serviceUsersWithMissingCount: number;
  serviceUserMissingTotalCount: number;
};

export type PropertyTemplateBreakdownRow = {
  formTemplateId: string;
  templateName: string;
  assignmentActive: boolean;
  lastSubmittedAt: string | null;
  lastSubmittedByName: string | null;
  lastSubmissionId: string | null;
  lastSubmissionStatus: string | null;
  filedInPeriod: boolean;
  scheduleNextDue: string | null;
  rowStatus: "COMPLETE" | "MISSING" | "OVERDUE";
};

function periodStart(): Date {
  return subDays(new Date(), MANAGER_FILING_WINDOW_DAYS);
}

/**
 * Cross-property snapshot for the manager dashboard: assignments vs filings in the last 30 days,
 * overdue schedules, and open audit actions per property.
 */
export async function getManagerDashboardData(): Promise<ManagerPropertySummary[]> {
  await requireAdmin();

  const todayStart = startOfDay(new Date());
  const since = periodStart();

  const [
    properties,
    globalTemplates,
    assignments,
    submissions,
    schedules,
    actionGroups,
    serviceUsers,
    suOverrides,
    carePackageLinks,
  ] = await Promise.all([
    prisma.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "GLOBAL" },
      select: { id: true },
    }),
    prisma.propertyFormAssignment.findMany({
      where: { isActive: true },
      include: { formTemplate: { select: { assignmentScope: true } } },
    }),
    prisma.auditFormSubmission.findMany({
      where: {
        createdAt: { gte: since },
        status: { in: [...FILING_STATUSES] },
      },
      select: { propertyId: true, serviceUserId: true, formTemplateId: true },
    }),
    prisma.auditSchedule.findMany({
      where: {
        isActive: true,
        formTemplateId: { not: null },
        nextDueDate: { lt: todayStart },
      },
      select: { propertyId: true, formTemplateId: true },
    }),
    prisma.auditAction.groupBy({
      by: ["propertyId"],
      where: { status: { in: ["OPEN", "IN_PROGRESS", "OVERDUE"] } },
      _count: { id: true },
    }),
    prisma.serviceUser.findMany({
      where: { propertyId: { not: null } },
      select: { id: true, propertyId: true, carePackageId: true },
    }),
    prisma.serviceUserFormAssignment.findMany({
      select: {
        serviceUserId: true,
        formTemplateId: true,
        isActive: true,
        formTemplate: { select: { assignmentScope: true } },
      },
    }),
    prisma.carePackageTemplate.findMany({
      include: {
        formTemplate: { select: { id: true, isActive: true, assignmentScope: true } },
      },
    }),
  ]);

  const globalTemplateIds = new Set(globalTemplates.map((g) => g.id));

  const propertyScopedByProperty = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.formTemplate.assignmentScope !== "PROPERTY") continue;
    let set = propertyScopedByProperty.get(a.propertyId);
    if (!set) {
      set = new Set();
      propertyScopedByProperty.set(a.propertyId, set);
    }
    set.add(a.formTemplateId);
  }

  const filedInPeriod = new Set<string>();
  const filedInPeriodByServiceUser = new Set<string>();
  for (const s of submissions) {
    filedInPeriod.add(`${s.propertyId}:${s.formTemplateId}`);
    if (s.serviceUserId) {
      filedInPeriodByServiceUser.add(`${s.serviceUserId}:${s.formTemplateId}`);
    }
  }

  const serviceUsersByProperty = new Map<string, string[]>();
  const carePackageIdByServiceUser = new Map<string, string | null>();
  for (const su of serviceUsers) {
    carePackageIdByServiceUser.set(su.id, su.carePackageId);
    if (!su.propertyId) continue;
    const list = serviceUsersByProperty.get(su.propertyId) ?? [];
    list.push(su.id);
    serviceUsersByProperty.set(su.propertyId, list);
  }

  const templateIdsByCarePackage = new Map<string, Set<string>>();
  for (const link of carePackageLinks) {
    const ft = link.formTemplate;
    if (!ft.isActive) continue;
    let set = templateIdsByCarePackage.get(link.carePackageId);
    if (!set) {
      set = new Set();
      templateIdsByCarePackage.set(link.carePackageId, set);
    }
    set.add(ft.id);
  }

  const overridesByServiceUser = new Map<
    string,
    Map<string, { active: boolean; scope: "GLOBAL" | "PROPERTY" | "SERVICE_USER" | "CARE_PACKAGE" }>
  >();
  for (const o of suOverrides) {
    let map = overridesByServiceUser.get(o.serviceUserId);
    if (!map) {
      map = new Map();
      overridesByServiceUser.set(o.serviceUserId, map);
    }
    map.set(o.formTemplateId, { active: o.isActive, scope: o.formTemplate.assignmentScope });
  }

  const overdueByProperty = new Map<string, Set<string>>();
  for (const sch of schedules) {
    if (!sch.formTemplateId) continue;
    const propSet = propertyScopedByProperty.get(sch.propertyId);
    const inScope =
      globalTemplateIds.has(sch.formTemplateId) || (propSet?.has(sch.formTemplateId) ?? false);
    if (!inScope) continue;
    let set = overdueByProperty.get(sch.propertyId);
    if (!set) {
      set = new Set();
      overdueByProperty.set(sch.propertyId, set);
    }
    set.add(sch.formTemplateId);
  }

  const openActionsByProperty = new Map<string, number>();
  for (const g of actionGroups) {
    openActionsByProperty.set(g.propertyId, g._count.id);
  }

  return properties.map((p) => {
    const propScoped = propertyScopedByProperty.get(p.id) ?? new Set<string>();
    const templateUnion = new Set<string>(globalTemplateIds);
    propScoped.forEach((tid) => templateUnion.add(tid));
    const total = templateUnion.size;
    let filed = 0;
    templateUnion.forEach((tid) => {
      if (filedInPeriod.has(`${p.id}:${tid}`)) filed += 1;
    });
    const missing = Math.max(0, total - filed);
    const overdueSet = overdueByProperty.get(p.id);

    const suIds = serviceUsersByProperty.get(p.id) ?? [];
    let serviceUsersWithMissingCount = 0;
    let serviceUserMissingTotalCount = 0;
    for (const suId of suIds) {
      const effective = new Set<string>(globalTemplateIds);
      propScoped.forEach((tid) => effective.add(tid));
      const pkgId = carePackageIdByServiceUser.get(suId);
      if (pkgId) {
        const fromPkg = templateIdsByCarePackage.get(pkgId);
        fromPkg?.forEach((tid) => effective.add(tid));
      }
      const ov = overridesByServiceUser.get(suId);
      if (ov) {
        ov.forEach((meta, tid) => {
          if (meta.scope === "SERVICE_USER" && meta.active) effective.add(tid);
          if (meta.scope === "PROPERTY" && !meta.active) effective.delete(tid);
          if (meta.scope === "CARE_PACKAGE" && !meta.active) effective.delete(tid);
        });
      }
      let filedForUser = 0;
      effective.forEach((tid) => {
        if (filedInPeriodByServiceUser.has(`${suId}:${tid}`)) filedForUser += 1;
      });
      const missingForUser = Math.max(0, effective.size - filedForUser);
      if (missingForUser > 0) {
        serviceUsersWithMissingCount += 1;
        serviceUserMissingTotalCount += missingForUser;
      }
    }
    return {
      propertyId: p.id,
      propertyName: p.name,
      totalAssignedTemplates: total,
      filedInPeriodCount: filed,
      missingInPeriodCount: missing,
      overdueScheduledCount: overdueSet?.size ?? 0,
      openActionsCount: openActionsByProperty.get(p.id) ?? 0,
      serviceUserCount: suIds.length,
      serviceUsersWithMissingCount,
      serviceUserMissingTotalCount,
    };
  });
}

/**
 * Per-template rows for one property: last submission, filing-in-period, schedule overdue flag.
 */
export async function getPropertyAuditBreakdown(propertyId: string): Promise<PropertyTemplateBreakdownRow[]> {
  await requireAdmin();

  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) return [];

  const since = periodStart();
  const todayStart = startOfDay(new Date());

  const [assignments, globals] = await Promise.all([
    prisma.propertyFormAssignment.findMany({
      where: { propertyId, isActive: true },
      include: {
        formTemplate: { select: { id: true, name: true, assignmentScope: true } },
      },
      orderBy: { formTemplate: { name: "asc" } },
    }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "GLOBAL" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const propertyScoped = assignments.filter((a) => a.formTemplate.assignmentScope === "PROPERTY");
  const rowList: { formTemplateId: string; templateName: string; assignmentActive: boolean }[] = [];
  const seenTid = new Set<string>();
  for (const g of globals) {
    if (seenTid.has(g.id)) continue;
    seenTid.add(g.id);
    rowList.push({ formTemplateId: g.id, templateName: g.name, assignmentActive: true });
  }
  for (const a of propertyScoped) {
    if (seenTid.has(a.formTemplateId)) continue;
    seenTid.add(a.formTemplateId);
    rowList.push({
      formTemplateId: a.formTemplateId,
      templateName: a.formTemplate.name,
      assignmentActive: a.isActive,
    });
  }

  if (rowList.length === 0) return [];

  const templateIds = rowList.map((r) => r.formTemplateId);

  const [latestSubmissions, periodSubmissions, schedules] = await Promise.all([
    prisma.auditFormSubmission.findMany({
      where: { propertyId, formTemplateId: { in: templateIds }, status: { in: [...FILING_STATUSES] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        formTemplateId: true,
        createdAt: true,
        status: true,
        submittedBy: { select: { name: true } },
      },
    }),
    prisma.auditFormSubmission.findMany({
      where: {
        propertyId,
        formTemplateId: { in: templateIds },
        createdAt: { gte: since },
        status: { in: [...FILING_STATUSES] },
      },
      select: { formTemplateId: true },
    }),
    prisma.auditSchedule.findMany({
      where: { propertyId, isActive: true, formTemplateId: { in: templateIds } },
      select: { formTemplateId: true, nextDueDate: true },
    }),
  ]);

  const latestByTemplate = new Map<
    string,
    { id: string; createdAt: Date; status: string; submitterName: string | null }
  >();
  for (const row of latestSubmissions) {
    if (!latestByTemplate.has(row.formTemplateId)) {
      latestByTemplate.set(row.formTemplateId, {
        id: row.id,
        createdAt: row.createdAt,
        status: row.status,
        submitterName: row.submittedBy?.name ?? null,
      });
    }
  }

  const filedInPeriodSet = new Set(periodSubmissions.map((s) => s.formTemplateId));

  const nextDueByTemplate = new Map<string, Date>();
  for (const sch of schedules) {
    if (!sch.formTemplateId) continue;
    const cur = nextDueByTemplate.get(sch.formTemplateId);
    if (!cur || sch.nextDueDate < cur) {
      nextDueByTemplate.set(sch.formTemplateId, sch.nextDueDate);
    }
  }

  return rowList.map((row) => {
    const tid = row.formTemplateId;
    const latest = latestByTemplate.get(tid);
    const filedInPeriod = filedInPeriodSet.has(tid);
    const nextDue = nextDueByTemplate.get(tid);
    const scheduleOverdue = nextDue !== undefined && nextDue < todayStart;

    let rowStatus: PropertyTemplateBreakdownRow["rowStatus"];
    if (scheduleOverdue) {
      rowStatus = "OVERDUE";
    } else if (filedInPeriod) {
      rowStatus = "COMPLETE";
    } else {
      rowStatus = "MISSING";
    }

    return {
      formTemplateId: tid,
      templateName: row.templateName,
      assignmentActive: row.assignmentActive,
      lastSubmittedAt: latest ? latest.createdAt.toISOString() : null,
      lastSubmittedByName: latest?.submitterName ?? null,
      lastSubmissionId: latest?.id ?? null,
      lastSubmissionStatus: latest?.status ?? null,
      filedInPeriod,
      scheduleNextDue: nextDue ? nextDue.toISOString() : null,
      rowStatus,
    };
  });
}

export type ManagerUpcomingAuditRow = {
  propertyId: string;
  propertyName: string;
  formTemplateId: string;
  templateName: string;
  filingFrequency: AuditScheduleFrequency;
  monthlyFilingDueDay: number | null;
  complianceStatus: TemplateComplianceStatus;
  complianceDetail: string;
  /** YYYY-MM-DD inclusive deadline, Europe/London calendar (weekly uses ISO week end as London date). */
  dueDateLondon: string;
  lastSubmittedAt: string | null;
};

/**
 * Cross-property list of assigned audit templates whose filing frequency indicates they are not yet
 * satisfied for the current period (UK calendar / ISO week rules — see `computeTemplateComplianceStatus`).
 */
export async function getManagerUpcomingComplianceRows(): Promise<ManagerUpcomingAuditRow[]> {
  await requireAdmin();

  const [properties, globals, allAssignments] = await Promise.all([
    prisma.property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditFormTemplate.findMany({
      where: { isActive: true, assignmentScope: "GLOBAL" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.propertyFormAssignment.findMany({
      where: { isActive: true },
      include: {
        formTemplate: { select: { id: true, name: true, assignmentScope: true, isActive: true } },
      },
    }),
  ]);

  const activeAssignments = allAssignments.filter((a) => a.formTemplate.isActive);

  type Pair = { propertyId: string; propertyName: string; formTemplateId: string; templateName: string };
  const pairs: Pair[] = [];

  for (const prop of properties) {
    const seen = new Set<string>();
    for (const g of globals) {
      const k = `${prop.id}:${g.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push({
        propertyId: prop.id,
        propertyName: prop.name,
        formTemplateId: g.id,
        templateName: g.name,
      });
    }
    const scoped = activeAssignments.filter(
      (a) => a.propertyId === prop.id && a.formTemplate.assignmentScope === "PROPERTY"
    );
    for (const a of scoped) {
      const k = `${prop.id}:${a.formTemplateId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push({
        propertyId: prop.id,
        propertyName: prop.name,
        formTemplateId: a.formTemplateId,
        templateName: a.formTemplate.name,
      });
    }
  }

  if (pairs.length === 0) return [];

  const templateIds = Array.from(new Set(pairs.map((p) => p.formTemplateId)));
  const propertyIds = Array.from(new Set(pairs.map((p) => p.propertyId)));
  const since = subDays(new Date(), 420);

  const [templates, submissions, latestByPair] = await Promise.all([
    prisma.auditFormTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, filingFrequency: true, monthlyFilingDueDay: true },
    }),
    prisma.auditFormSubmission.findMany({
      where: {
        propertyId: { in: propertyIds },
        formTemplateId: { in: templateIds },
        status: { in: [...FILING_STATUSES] },
        createdAt: { gte: since },
      },
      select: { propertyId: true, formTemplateId: true, createdAt: true },
    }),
    prisma.auditFormSubmission.findMany({
      where: {
        propertyId: { in: propertyIds },
        formTemplateId: { in: templateIds },
        status: { in: [...FILING_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: { propertyId: true, formTemplateId: true, createdAt: true },
    }),
  ]);

  const tmplMap = new Map(templates.map((t) => [t.id, t]));
  const datesByPair = new Map<string, Date[]>();
  for (const s of submissions) {
    const key = `${s.propertyId}:${s.formTemplateId}`;
    const arr = datesByPair.get(key) ?? [];
    arr.push(s.createdAt);
    datesByPair.set(key, arr);
  }

  const lastAt = new Map<string, Date>();
  for (const s of latestByPair) {
    const key = `${s.propertyId}:${s.formTemplateId}`;
    if (!lastAt.has(key)) lastAt.set(key, s.createdAt);
  }

  const out: ManagerUpcomingAuditRow[] = [];
  const seenPair = new Set<string>();
  for (const p of pairs) {
    const pk = `${p.propertyId}:${p.formTemplateId}`;
    if (seenPair.has(pk)) continue;
    seenPair.add(pk);
    const meta = tmplMap.get(p.formTemplateId);
    if (!meta) continue;
    const dates = datesByPair.get(pk) ?? [];
    const { status, detail, periodDueDateLondon } = computeTemplateComplianceStatus({
      frequency: meta.filingFrequency,
      monthlyFilingDueDay: meta.monthlyFilingDueDay,
      submissionDates: dates,
    });
    if (status === "OK") continue;
    const last = lastAt.get(pk);
    out.push({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      formTemplateId: p.formTemplateId,
      templateName: p.templateName,
      filingFrequency: meta.filingFrequency,
      monthlyFilingDueDay: meta.monthlyFilingDueDay,
      complianceStatus: status,
      complianceDetail: detail,
      dueDateLondon: periodDueDateLondon,
      lastSubmittedAt: last ? last.toISOString() : null,
    });
  }

  const rank: Record<TemplateComplianceStatus, number> = {
    OVERDUE: 0,
    DUE_THIS_PERIOD: 1,
    DUE_SOON: 2,
    OK: 3,
  };
  out.sort((a, b) => {
    const rc = rank[a.complianceStatus] - rank[b.complianceStatus];
    if (rc !== 0) return rc;
    return a.propertyName.localeCompare(b.propertyName) || a.templateName.localeCompare(b.templateName);
  });

  return out;
}

export type ManagerClockAttendanceRow = {
  id: string;
  workerName: string;
  propertyName: string;
  clockInAt: string;
  clockOutAt: string | null;
  totalMinutes: number | null;
  shiftType: string;
  offRosterReason: string | null;
  linkedRosterServiceUserName: string | null;
};

/**
 * Clock in/out snapshot for Audit manager: who is on shift and recent completed clocks (feeds from the same
 * `TimeRecord` rows as Hours / payroll). Clock events are also written to `AuditLog` with structured JSON.
 */
export async function getManagerClockAttendanceSnapshot(): Promise<{
  onShift: ManagerClockAttendanceRow[];
  recentCompleted: ManagerClockAttendanceRow[];
}> {
  await requireAdmin();
  const since = subDays(new Date(), 14);
  const rosterCols = await timeRecordHasRosterExceptionColumns();
  const attendanceSelect = {
    ...timeRecordCoreSelect,
    ...(rosterCols
      ? {
          offRosterReason: true,
          linkedShiftId: true,
          linkedShift: { select: { serviceUser: { select: { name: true } } } },
        }
      : {}),
    user: { select: { name: true } },
    property: { select: { name: true } },
  };

  const [onShift, recentCompleted] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { clockOutAt: null },
      orderBy: { clockInAt: "desc" },
      take: 25,
      select: attendanceSelect,
    }),
    prisma.timeRecord.findMany({
      where: { clockOutAt: { not: null, gte: since } },
      orderBy: { clockOutAt: "desc" },
      take: 45,
      select: attendanceSelect,
    }),
  ]);

  const toRow = (r: (typeof onShift)[number]): ManagerClockAttendanceRow => {
    const linked = r as typeof r & {
      linkedShift?: { serviceUser?: { name: string } | null } | null;
    };
    return {
      id: r.id,
      workerName: r.user.name,
      propertyName: r.property.name,
      clockInAt: r.clockInAt.toISOString(),
      clockOutAt: r.clockOutAt?.toISOString() ?? null,
      totalMinutes: r.totalMinutes,
      shiftType: r.shiftType,
      offRosterReason: ("offRosterReason" in r ? r.offRosterReason : null) ?? null,
      linkedRosterServiceUserName: linked.linkedShift?.serviceUser?.name ?? null,
    };
  };

  return {
    onShift: onShift.map(toRow),
    recentCompleted: recentCompleted.map(toRow),
  };
}
