import type { AuditScheduleFrequency, AuditTemplateAssignmentScope } from "@prisma/client";
import { parseAuditTemplateFields } from "@/lib/audit-template-schema";

export type AuditTemplateSnapshot = {
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
};

function fieldKeys(fields: unknown): string[] {
  const r = parseAuditTemplateFields(fields);
  if (!r.ok) return [];
  return r.fields.map((f) => String((f as { key?: string }).key ?? "")).filter(Boolean);
}

export function buildAuditTemplateChangePayload(
  before: AuditTemplateSnapshot,
  after: AuditTemplateSnapshot
): { summaryLine: string; changesJson: Record<string, unknown> } {
  const parts: string[] = [];
  const json: Record<string, unknown> = {};

  if (before.name !== after.name) {
    parts.push("name");
    json.name = { from: before.name, to: after.name };
  }
  if (before.description !== after.description) {
    parts.push("description");
    json.description = { from: before.description, to: after.description };
  }
  if (before.category !== after.category) {
    parts.push("category");
    json.category = { from: before.category, to: after.category };
  }
  if (before.assignmentScope !== after.assignmentScope) {
    parts.push("assignmentScope");
    json.assignmentScope = { from: before.assignmentScope, to: after.assignmentScope };
  }
  if (before.templateCode !== after.templateCode) {
    parts.push("templateCode");
    json.templateCode = { from: before.templateCode, to: after.templateCode };
  }
  if (before.aiAssistantPrompt !== after.aiAssistantPrompt) {
    parts.push("aiAssistantPrompt");
    json.aiAssistantPrompt = { changed: true };
  }
  if (before.filingFrequency !== after.filingFrequency) {
    parts.push("filingFrequency");
    json.filingFrequency = { from: before.filingFrequency, to: after.filingFrequency };
  }
  if (before.monthlyFilingDueDay !== after.monthlyFilingDueDay) {
    parts.push("monthlyFilingDueDay");
    json.monthlyFilingDueDay = { from: before.monthlyFilingDueDay, to: after.monthlyFilingDueDay };
  }
  if (before.isActive !== after.isActive) {
    parts.push("isActive");
    json.isActive = { from: before.isActive, to: after.isActive };
  }

  const fieldsJsonBefore = JSON.stringify(before.fields);
  const fieldsJsonAfter = JSON.stringify(after.fields);
  if (fieldsJsonBefore !== fieldsJsonAfter) {
    parts.push("fields");
    json.fields = {
      keysBefore: fieldKeys(before.fields),
      keysAfter: fieldKeys(after.fields),
      fieldCountBefore: fieldKeys(before.fields).length,
      fieldCountAfter: fieldKeys(after.fields).length,
    };
  }

  const summaryLine =
    parts.length === 0
      ? "No material changes detected."
      : `Updated: ${parts.join(", ")}.`;

  return { summaryLine, changesJson: json };
}
