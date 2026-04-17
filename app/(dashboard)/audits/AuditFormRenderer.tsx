"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiveDateTimeDisplay } from "@/components/hours/LiveDateTimeDisplay";
import { AuditReportFilingHeader } from "@/components/audits/AuditReportFilingHeader";
import { AuditAiValidationWizard } from "./AuditAiValidationWizard";
import { applyFreshFormSmartDefaults, buildSmartDefaultsTableRow } from "@/lib/audit-form-smart-defaults";
import { normalizeDateInputForStorage, toIsoDateInputValue } from "@/lib/audit-form-dates";
import {
  auditFormValueIsEmpty,
  normalizeAuditFormPayloadForStorage,
} from "@/lib/audit-form-normalize-payload";
import type { FormAiValidationResult } from "@/lib/audit-form-ai-validate";
import {
  getLondonHour,
  getTimingBlockingIssues,
  getTimingBlockingIssuesStructured,
  type TimingBlockingIssue,
} from "@/lib/audit-form-timing-validation";
import {
  assessDateFieldValue,
  assessNumericRange,
  assessTableCell,
  assessTopLevelField,
  collectVitalActionPlanFindings,
  columnLooksLikeBp,
  columnLooksLikePulse,
  getBlockingAuditFieldIssues,
  getBlockingAuditFieldIssuesStructured,
  getUkVitalsThresholdsForAge,
  toneBorderClass,
  vitalsDisclaimer,
  type AuditFormatBlockingIssue,
  type VitalActionPlanEntry,
} from "@/lib/audit-field-vitals";
import { getAgeYearsFromIso, PULSE_BPM_MAX, PULSE_BPM_MIN } from "@/lib/audit-vitals-uk-age";
import { cn } from "@/lib/utils";

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

function normalizePayloadForStorage(fields: Field[], values: Record<string, unknown>): Record<string, unknown> {
  return normalizeAuditFormPayloadForStorage(fields, values);
}

function valueIsEmpty(v: unknown): boolean {
  return auditFormValueIsEmpty(v);
}

/** Destructive border when this cell/field blocks save (paired with inline message). */
const SUBMIT_BLOCKING_FIELD_CLASS =
  "border-2 border-destructive/80 focus-visible:ring-destructive/40";

/** Clearer labels for staff filling audits on phones/tablets. */
const STAFF_FIELD_LABEL = "text-base font-semibold text-slate-900 leading-snug";

function auditFormatBlockForCell(
  issues: AuditFormatBlockingIssue[],
  fieldKey: string,
  rowIndex: number,
  columnKey: string
): string | undefined {
  return issues.find(
    (i) => i.fieldKey === fieldKey && i.rowIndex === rowIndex && i.columnKey === columnKey
  )?.message;
}

function auditFormatBlockForField(issues: AuditFormatBlockingIssue[], fieldKey: string): string | undefined {
  return issues.find((i) => i.fieldKey === fieldKey && i.rowIndex == null && i.columnKey == null)?.message;
}

function auditTimingBlockForRow(
  issues: TimingBlockingIssue[],
  fieldKey: string,
  rowIndex: number
): string | undefined {
  return issues.find((t) => t.fieldKey === fieldKey && t.rowIndex === rowIndex)?.message;
}

function withAiMeta(
  payload: Record<string, unknown>,
  result: FormAiValidationResult | null,
  skipReason?: string
): Record<string, unknown> {
  if (!result) {
    return {
      ...payload,
      __aiFormValidation: {
        skipped: true,
        checkedAt: new Date().toISOString(),
        ...(skipReason ? { skipReason } : {}),
      },
    };
  }
  return {
    ...payload,
    __aiFormValidation: {
      checkedAt: new Date().toISOString(),
      cannot_save: result.cannot_save,
      summary: result.summary,
      timing_review: result.timing_review,
      limits_review: result.limits_review,
      suggested_actions: result.suggested_actions,
      field_notes: result.field_notes,
    },
  };
}

function RecordingContextBanner({
  templateName,
  patientSummary,
  ageYears,
}: {
  templateName: string;
  patientSummary?: string | null;
  ageYears: number | null;
}) {
  const isBp = templateName.toLowerCase().includes("blood pressure");
  const thresholds = getUkVitalsThresholdsForAge(ageYears);
  const ageBandLine =
    ageYears === null
      ? "Adult default bands (approx. 18–64) — link DOB for age-specific hints."
      : thresholds.ageLabel;
  const [nextDue, setNextDue] = useState("");
  const [contextLine, setContextLine] = useState("");
  const [tipsOpen, setTipsOpen] = useState(isBp);

  useEffect(() => {
    setTipsOpen(isBp);
  }, [isBp]);

  useEffect(() => {
    function tick() {
      if (!isBp) {
        setNextDue("");
        setContextLine("Use dd/mm/yyyy for date fields. This timestamp is when you save this report.");
        return;
      }
      const h = getLondonHour(new Date());
      if (h < 12) {
        setNextDue("Next due: this evening — second reading of the day (before bed).");
        setContextLine(
          "You are recording the morning part of your twice‑daily BP diary (or your first reading of the day)."
        );
      } else {
        setNextDue("Next due: tomorrow morning — first reading of the day (continue twice daily for 7 days).");
        setContextLine(
          "You are recording the evening part of your twice‑daily BP diary (or your second reading of the day)."
        );
      }
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [isBp]);

  return (
    <div className="rounded-xl border border-[#005EB8]/25 bg-gradient-to-b from-[#E8F4FC] to-white p-3 sm:p-4 space-y-2 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#005EB8]">You are recording now</p>
        <LiveDateTimeDisplay variant="compact" />
      </div>
      <button
        type="button"
        className="text-sm font-medium text-[#005EB8] underline underline-offset-2 touch-manipulation min-h-[44px] py-1 text-left"
        onClick={() => setTipsOpen((o) => !o)}
        aria-expanded={tipsOpen}
      >
        {tipsOpen ? "Hide tips for this form" : "Show tips for this form"}
      </button>
      {patientSummary ? (
        <p className="text-base font-medium text-slate-800">Patient / service user: {patientSummary}</p>
      ) : null}
      {tipsOpen ? (
        <div className="space-y-2 border-t border-[#005EB8]/15 pt-2">
          {isBp ? (
            <p className="text-xs text-muted-foreground border-l-2 border-[#005EB8]/40 pl-2">
              Age-based screening hints: <span className="font-medium text-slate-700">{ageBandLine}</span>
            </p>
          ) : null}
          {contextLine ? <p className="text-sm text-muted-foreground leading-relaxed">{contextLine}</p> : null}
          {nextDue ? (
            <p className="text-sm font-semibold text-[#007F3B]" role="status">
              {nextDue}
            </p>
          ) : null}
          {isBp ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Take at least 2 readings morning and evening for 7 days. Use <strong>Add row</strong> to enter each reading in
                the table (date, AM/PM, BP and pulse, comments). BP as <strong>120/80</strong> mmHg; field borders reflect the
                age band above (indicative only). Before save, automatic validation checks timing and values.
              </p>
              <p className="text-xs text-muted-foreground">{vitalsDisclaimer()}</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AuditFormRenderer({
  templateName = "Audit form",
  propertyName,
  recordedByName,
  aiAssistantPrompt,
  fields,
  initialValues,
  patientSummary,
  patientDateOfBirthIso,
  onSubmit,
  submitLabel = "Submit report",
  previewOnly = false,
  /** Read-only fields (e.g. viewing a submitted report preview). Implies no edits; use with `previewOnly`. */
  readOnly = false,
}: {
  templateName?: string;
  /** Care venue (property) shown in report header. */
  propertyName?: string | null;
  /** Current user / staff name for report header. */
  recordedByName?: string | null;
  /** Per-template anonymous AI instructions (no patient data sent to the model). */
  aiAssistantPrompt?: string | null;
  fields: Field[];
  initialValues?: Record<string, unknown>;
  /** Shown in banner when a service user was selected for this recording */
  patientSummary?: string | null;
  /** Service user DOB (ISO) — UK age-stratified vital bands and post-submit action plan */
  patientDateOfBirthIso?: string | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
  /**
   * Admin template editor: interactive preview only — no submit, drafts, AI validation, or filing header.
   * Resets sample values when `fields` schema changes.
   */
  previewOnly?: boolean;
  readOnly?: boolean;
}) {
  const isRo = readOnly === true;
  const tableDefaults = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    for (const f of fields) {
      if (f.type === "TABLE_GRID") {
        map[f.key] = [];
      }
    }
    return map;
  }, [fields]);

  const initialKey = useMemo(() => JSON.stringify(initialValues ?? {}), [initialValues]);

  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...tableDefaults,
    ...(initialValues ?? {}),
  }));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [vitalsPlanOpen, setVitalsPlanOpen] = useState(false);
  const [vitalsFindings, setVitalsFindings] = useState<VitalActionPlanEntry[]>([]);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string>("");
  /** AI validation step returned hard blocks (no structured path — banner only). */
  const [aiBlockingLines, setAiBlockingLines] = useState<string[]>([]);
  const [aiValOpen, setAiValOpen] = useState(false);
  const [aiValLoading, setAiValLoading] = useState(false);
  const [aiValResult, setAiValResult] = useState<FormAiValidationResult | null>(null);
  const [pendingAiPayload, setPendingAiPayload] = useState<Record<string, unknown> | null>(null);
  const pendingAiPayloadRef = useRef<Record<string, unknown> | null>(null);
  const aiValResultRef = useRef<FormAiValidationResult | null>(null);

  useEffect(() => {
    pendingAiPayloadRef.current = pendingAiPayload;
  }, [pendingAiPayload]);
  useEffect(() => {
    aiValResultRef.current = aiValResult;
  }, [aiValResult]);

  const templateNameLower = useMemo(() => templateName.toLowerCase(), [templateName]);
  const ageYears = useMemo(() => getAgeYearsFromIso(patientDateOfBirthIso ?? null), [patientDateOfBirthIso]);
  const mergedValues = useMemo(() => ({ ...tableDefaults, ...values }), [tableDefaults, values]);
  const formatBlockingIssues = useMemo(
    () =>
      previewOnly
        ? []
        : getBlockingAuditFieldIssuesStructured(templateNameLower, fields, mergedValues, ageYears),
    [previewOnly, templateNameLower, fields, mergedValues, ageYears]
  );
  const timingBlockingIssues = useMemo(
    () => (previewOnly ? [] : getTimingBlockingIssuesStructured(fields, mergedValues)),
    [previewOnly, fields, mergedValues]
  );
  const validationBlockingLines = useMemo(
    () => [
      ...formatBlockingIssues.map((i) => `${i.pathLabel}: ${i.message}`),
      ...timingBlockingIssues.map((i) => `${i.pathLabel}: ${i.message}`),
    ],
    [formatBlockingIssues, timingBlockingIssues]
  );
  const allBlockingBannerLines = useMemo(
    () => [...validationBlockingLines, ...aiBlockingLines],
    [validationBlockingLines, aiBlockingLines]
  );

  /** Simple progress for long forms (staff UX). */
  const staffFormProgress = useMemo(() => {
    if (previewOnly) return null;
    let steps = 0;
    let done = 0;
    for (const f of fields) {
      if (f.type === "SECTION_HEADER" || f.type === "INFO_TEXT") continue;
      steps += 1;
      if (f.type === "TABLE_GRID") {
        const rows = (values[f.key] as Record<string, unknown>[] | undefined) ?? [];
        const anyFilled = rows.some((row) =>
          (f.columns ?? []).some((c) => !valueIsEmpty(row[c.key]))
        );
        if (anyFilled) done += 1;
      } else if (!valueIsEmpty(values[f.key])) {
        done += 1;
      }
    }
    if (steps === 0) return null;
    return { steps, done };
  }, [fields, values, previewOnly]);

  const draftStorageKey = useMemo(
    () =>
      `audit-form-draft:${templateName}:${patientSummary ?? "unknown"}:${patientDateOfBirthIso ?? "no-dob"}`,
    [templateName, patientSummary, patientDateOfBirthIso]
  );

  const fieldsSchemaKey = useMemo(() => JSON.stringify(fields), [fields]);

  useEffect(() => {
    if (!previewOnly) return;
    let merged: Record<string, unknown> = { ...tableDefaults };
    if (!readOnly) {
      merged = applyFreshFormSmartDefaults(fields, merged);
    }
    if (initialValues && Object.keys(initialValues).length > 0) {
      merged = { ...merged, ...initialValues };
    }
    setValues(merged);
    setError("");
    setAiBlockingLines([]);
  }, [previewOnly, readOnly, fieldsSchemaKey, tableDefaults, fields, initialValues]);

  useEffect(() => {
    if (previewOnly) return;
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(initialKey) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    let draft: Record<string, unknown> = {};
    let hadDraft = false;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (raw) {
        hadDraft = true;
        try {
          draft = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          draft = {};
        }
      }
    }
    let merged: Record<string, unknown> = { ...tableDefaults, ...parsed, ...draft };
    if (!hadDraft) {
      merged = applyFreshFormSmartDefaults(fields, merged);
    }
    setValues(merged);
    // fields omitted from deps: stable for /audits/submit/[id]; including it can reset the form if the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- template schema is fixed for this page load
  }, [initialKey, tableDefaults, draftStorageKey]);

  useEffect(() => {
    if (previewOnly || typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(values));
      setDraftSavedAt(new Date().toLocaleTimeString());
    }, 350);
    return () => window.clearTimeout(id);
  }, [values, draftStorageKey, previewOnly]);

  async function flushSubmit(payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      await onSubmit(payload);
      if (typeof window !== "undefined") window.localStorage.removeItem(draftStorageKey);
      let next = { ...tableDefaults, ...(initialValues ?? {}) };
      next = applyFreshFormSmartDefaults(fields, next);
      setValues(next);
      setAiValOpen(false);
      setPendingAiPayload(null);
      setAiValResult(null);
      setAiBlockingLines([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form");
    } finally {
      setPending(false);
    }
  }

  async function startAiValidation(payload: Record<string, unknown>) {
    setError("");
    setAiBlockingLines([]);
    setAiValLoading(true);
    setAiValOpen(true);
    setAiValResult(null);
    setPendingAiPayload(payload);
    try {
      const res = await fetch("/api/audits/validate-form-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldsSchema: fields,
          payload,
          adminAiPrompt: aiAssistantPrompt ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        blocking?: string[];
        result?: FormAiValidationResult;
      };
      if (res.status === 400 && Array.isArray(data.blocking)) {
        setAiValOpen(false);
        setAiBlockingLines(data.blocking);
        setPendingAiPayload(null);
        return;
      }
      if (res.status === 503) {
        setAiValOpen(false);
        await flushSubmit(withAiMeta(payload, null, "ai_not_configured"));
        return;
      }
      if (!res.ok) {
        setAiValOpen(false);
        const payloadSnapshot = pendingAiPayloadRef.current;
        if (payloadSnapshot && res.status >= 500) {
          setError("");
          await flushSubmit(withAiMeta(payloadSnapshot, null, "validation_unavailable"));
          setPendingAiPayload(null);
          return;
        }
        setError(data.error ?? "Validation could not complete.");
        setPendingAiPayload(null);
        return;
      }
      if (!data.result) {
        setAiValOpen(false);
        setError("Validation returned no result.");
        setPendingAiPayload(null);
        return;
      }
      setAiValResult(data.result);
    } catch {
      setAiValOpen(false);
      const payloadSnapshot = pendingAiPayloadRef.current;
      if (payloadSnapshot) {
        setError("");
        await flushSubmit(withAiMeta(payloadSnapshot, null, "validation_unavailable"));
      } else {
        setError("Could not run validation. Check your connection and try again.");
      }
      setPendingAiPayload(null);
    } finally {
      setAiValLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAiBlockingLines([]);
    for (const field of fields) {
      if (!field.required) continue;
      if (field.type === "TABLE_GRID") {
        const rows = (values[field.key] as Record<string, unknown>[] | undefined) ?? tableDefaults[field.key] ?? [];
        if (rows.length === 0) {
          setError(`Please complete ${field.label}.`);
          return;
        }
        continue;
      }
      if (field.type === "SECTION_HEADER" || field.type === "INFO_TEXT") continue;
      if (valueIsEmpty(values[field.key])) {
        setError(`Please complete ${field.label}.`);
        return;
      }
    }
    const merged = { ...tableDefaults, ...values };
    const blocking = getBlockingAuditFieldIssues(templateNameLower, fields, merged, ageYears);
    const timingBlocking = getTimingBlockingIssues(fields, merged);
    if (blocking.length + timingBlocking.length > 0) {
      return;
    }
    const payload = normalizePayloadForStorage(fields, merged);
    const findings = collectVitalActionPlanFindings(templateNameLower, fields, merged, ageYears);
    if (findings.length > 0) {
      setPendingPayload(payload);
      setVitalsFindings(findings);
      setVitalsPlanOpen(true);
      return;
    }
    await startAiValidation(payload);
  }

  const maxRecheckHours =
    vitalsFindings.length > 0 ? Math.max(...vitalsFindings.map((f) => f.recheckHours)) : 0;
  const hasUrgent = vitalsFindings.some((f) => f.level === "urgent");

  async function confirmVitalsSubmit(choice: "followup" | "recheck") {
    if (!pendingPayload) return;
    const blocking = getBlockingAuditFieldIssues(templateNameLower, fields, pendingPayload, ageYears);
    const timingBlocking = getTimingBlockingIssues(fields, pendingPayload);
    if (blocking.length + timingBlocking.length > 0) {
      setVitalsPlanOpen(false);
      setPendingPayload(null);
      setVitalsFindings([]);
      return;
    }
    const withPlan: Record<string, unknown> = {
      ...pendingPayload,
      __vitalsActionPlan: {
        acknowledgedAt: new Date().toISOString(),
        userChoice: choice,
        recommendedRecheckHours: choice === "recheck" ? maxRecheckHours : null,
        ageYearsUsed: ageYears,
        findings: vitalsFindings,
      },
    };
    setVitalsPlanOpen(false);
    setPendingPayload(null);
    setVitalsFindings([]);
    await startAiValidation(withPlan);
  }

  function dismissVitalsPlan() {
    setVitalsPlanOpen(false);
    setPendingPayload(null);
    setVitalsFindings([]);
  }

  function onFormSubmit(e: React.FormEvent) {
    if (previewOnly) {
      e.preventDefault();
      return;
    }
    void handleSubmit(e);
  }

  return (
    <>
    <form onSubmit={onFormSubmit} className="space-y-6">
      {!previewOnly && propertyName != null && recordedByName != null ? (
        <AuditReportFilingHeader
          templateName={templateName}
          propertyName={propertyName}
          patientLine={patientSummary}
          recordedByName={recordedByName}
          mode="recording"
        />
      ) : null}

      {previewOnly ? (
        <div className="rounded-lg border border-dashed border-[#005EB8]/35 bg-[#E8F4FC]/50 p-4 space-y-1">
          <p className="text-sm font-semibold text-[#005EB8]">
            {isRo ? "Submitted report (preview)" : "Live preview"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isRo ? (
              <>
                Read-only copy of the saved answers for <strong className="text-foreground">{templateName}</strong>. Use{" "}
                <strong className="text-foreground">Raw JSON</strong> below if you need the exact stored payload.
              </>
            ) : (
              <>
                Staff-facing layout for <strong className="text-foreground">{templateName}</strong>. Edits in the field
                builder above refresh this area. Submit, drafts, and validation are turned off here.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#005EB8] leading-tight">
            Form: {templateName}
          </h1>
          <p className="text-base text-slate-700 leading-relaxed">
            Work through each question below. Tap <strong className="font-semibold text-slate-900">Submit report</strong> at
            the bottom when you are done. After submit, the report appears under{" "}
            <strong className="font-semibold text-slate-900">Form recording → All reports</strong>.
          </p>
          {draftSavedAt ? (
            <p className="text-xs text-muted-foreground">Draft autosaved {draftSavedAt}</p>
          ) : null}
        </div>
      )}

      {!previewOnly ? (
        <RecordingContextBanner
          templateName={templateName}
          patientSummary={patientSummary}
          ageYears={ageYears}
        />
      ) : null}

      {!previewOnly && staffFormProgress && staffFormProgress.steps > 4 ? (
        <div
          className={cn(
            "sticky z-20 -mx-4 px-4 sm:-mx-5 sm:px-5 py-2.5 sm:py-3 space-y-2",
            "top-[calc(3.5rem+env(safe-area-inset-top,0px))]",
            "border border-[#005EB8]/20 bg-[#F8FAFC]/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/90 shadow-sm",
            "rounded-lg"
          )}
          role="status"
          aria-label="Form progress"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-[#005EB8]">Your progress</span>
            <span className="text-muted-foreground tabular-nums">
              {staffFormProgress.done} / {staffFormProgress.steps} parts started
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[#E8EDEE] overflow-hidden" aria-hidden>
            <div
              className="h-full rounded-full bg-[#005EB8] transition-[width] duration-300 ease-out"
              style={{
                width: `${Math.min(100, Math.round((staffFormProgress.done / staffFormProgress.steps) * 100))}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fill required items (marked when you try to submit). Long forms: use{" "}
            <strong className="text-slate-700">Show tips</strong> above if you need help for this template.
          </p>
        </div>
      ) : null}

      {!previewOnly && allBlockingBannerLines.length > 0 ? (
        <div
          className="rounded-lg border border-destructive/35 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <p className="font-semibold text-destructive">This report cannot be saved yet</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Fix the fields marked below — each one shows why it blocks save.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5 text-slate-800">
            {allBlockingBannerLines.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p> : null}
      {fields.map((field, fieldIndex) => {
        if (field.type === "SECTION_HEADER") {
          return (
            <h3
              key={field.key}
              className={cn(
                "text-lg font-semibold text-[#005EB8] leading-snug pt-4",
                fieldIndex > 0 && "mt-2 border-t border-[#E8EDEE]"
              )}
            >
              {field.label}
            </h3>
          );
        }
        if (field.type === "INFO_TEXT") {
          return (
            <div
              key={field.key}
              className="rounded-md border border-[#005EB8]/20 bg-[#E8F4FC]/50 px-3 py-2 text-sm text-slate-700 leading-relaxed"
              role="note"
            >
              {field.label}
            </div>
          );
        }
        if (field.type === "TEXTAREA") {
          const fieldBlockMsg = auditFormatBlockForField(formatBlockingIssues, field.key);
          return (
            <div key={field.key} className="space-y-2">
              <Label className={STAFF_FIELD_LABEL}>{field.label}</Label>
              <Textarea
                readOnly={isRo}
                disabled={isRo}
                aria-invalid={fieldBlockMsg ? true : undefined}
                className={cn(
                  "text-base touch-manipulation",
                  previewOnly ? "min-h-[120px]" : "min-h-[180px]",
                  isRo && "bg-muted/40 cursor-default",
                  fieldBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS
                )}
                value={String(values[field.key] ?? "")}
                onChange={(e) => {
                  if (isRo) return;
                  setValues((s) => ({ ...s, [field.key]: e.target.value }));
                }}
                title={fieldBlockMsg ?? undefined}
              />
              {fieldBlockMsg ? (
                <p className="text-xs text-destructive leading-snug" role="status">
                  Cannot save: {fieldBlockMsg}
                </p>
              ) : null}
            </div>
          );
        }
        if (field.type === "YES_NO" || field.type === "DROPDOWN") {
          const opts = field.type === "YES_NO" ? ["Yes", "No"] : field.options ?? [];
          const cur = values[field.key];
          const strVal = typeof cur === "string" && cur !== "" ? cur : undefined;
          const dropdownItems = Object.fromEntries(opts.map((opt) => [opt, opt] as [string, string]));
          return (
            <div key={field.key} className="space-y-2">
              <Label className={STAFF_FIELD_LABEL}>{field.label}</Label>
              <Select
                items={dropdownItems}
                value={strVal}
                disabled={isRo}
                onValueChange={(v) => {
                  if (isRo) return;
                  setValues((s) => ({ ...s, [field.key]: v ?? "" }));
                }}
              >
                <SelectTrigger className="min-h-[44px] w-full max-w-md touch-manipulation">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {opts.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        if (field.type === "TABLE_GRID") {
          const rows = (values[field.key] as Record<string, unknown>[] | undefined) ?? tableDefaults[field.key] ?? [];
          const isBpDiaryTable = templateNameLower.includes("blood pressure");
          const fk = field.key;
          const setGridCell = (rowIndex: number, colKey: string, val: unknown) => {
            if (isRo) return;
            setValues((s) => {
              const cur = [...((s[fk] as Record<string, unknown>[]) ?? [])];
              while (cur.length <= rowIndex) cur.push({});
              cur[rowIndex] = { ...cur[rowIndex], [colKey]: val };
              return { ...s, [fk]: cur };
            });
          };
          return (
            <div key={field.key} className="space-y-2 overflow-x-auto">
              <Label className={STAFF_FIELD_LABEL}>{field.label}</Label>
              {!isRo && isBpDiaryTable ? (
                <div className="rounded-xl border border-[#005EB8]/25 bg-gradient-to-b from-[#E8F4FC]/90 to-white p-3 space-y-2 shadow-sm">
                  <p className="text-sm font-semibold text-[#005EB8]">Structured diary (clinical-style rows)</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Matches how <strong>home BP programmes</strong> and <strong>remote monitoring</strong> forms usually
                    work: fixed columns for <strong>when</strong> the reading was taken and <strong>numbered vitals</strong>,
                    not free‑text blocks — so records stay consistent for handover and audit.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4 marker:text-[#005EB8]">
                    <li>
                      <strong className="text-slate-800">Add row</strong>, then fill each cell in the table (date, AM/PM,
                      readings, comments).
                    </li>
                    <li>
                      <strong className="text-slate-800">Date</strong>: calendar or paste UK dates (
                      <strong>5/3/2025</strong> style is fine; we normalise when you leave the field).
                    </li>
                    <li>
                      <strong className="text-slate-800">BP / pulse</strong>: borders reflect the screening band for this
                      person&apos;s age — hover the field for detail.
                    </li>
                  </ul>
                </div>
              ) : !isRo ? (
                <p className="text-xs text-muted-foreground">
                  Use <strong>Add row</strong> to add a line, then edit cells below. <strong>Remove</strong> deletes a row.
                </p>
              ) : null}
              {isBpDiaryTable && !isRo ? (
                <div
                  className="rounded-lg border border-[#005EB8]/25 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
                  role="note"
                >
                  <span className="font-semibold text-[#005EB8]">Format: </span>
                  <strong className="font-medium text-slate-900">Blood pressure (mmHg)</strong> — systolic/diastolic with
                  a slash, e.g. <span className="font-mono text-[#005EB8]">120/80</span>.{" "}
                  <strong className="font-medium text-slate-900">Pulse (bpm)</strong> — whole number, typically{" "}
                  {PULSE_BPM_MIN}–{PULSE_BPM_MAX} at rest.
                </div>
              ) : null}
              {!isRo ? (
              <Button
                type="button"
                className="min-h-[44px] touch-manipulation bg-[#005EB8] hover:bg-[#004a94]"
                onClick={() =>
                  setValues((s) => ({
                    ...s,
                    [fk]: [
                      ...((s[fk] as Record<string, unknown>[]) ?? []),
                      buildSmartDefaultsTableRow(field),
                    ],
                  }))
                }
              >
                Add row
              </Button>
              ) : null}
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-[#005EB8]/30 bg-[#E8F4FC]/20 px-3 py-4">
                  No rows yet. A starter row normally appears automatically; tap <strong>Add row</strong> if you cleared
                  the table.
                </p>
              ) : (
                <Table
                  aria-label={isBpDiaryTable ? "Blood pressure diary" : `${field.label} table`}
                  className="table-fixed min-w-[760px] w-full"
                >
                  <TableHeader>
                    <TableRow className="border-[#005EB8]/15 hover:bg-transparent">
                      {field.columns?.map((c) => (
                        <TableHead
                          key={c.key}
                          className={cn(
                            "align-bottom font-medium",
                            isBpDiaryTable && "text-[#005EB8] whitespace-nowrap"
                          )}
                        >
                          {c.label}
                        </TableHead>
                      ))}
                      {!isRo ? (
                        <TableHead className="align-bottom font-medium w-[6rem] text-right">Actions</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, idx) => {
                      const timingRowMsg = auditTimingBlockForRow(timingBlockingIssues, fk, idx);
                      const gridColSpan = (field.columns?.length ?? 0) + (isRo ? 0 : 1);
                      return (
                        <Fragment key={idx}>
                          <TableRow
                            className={cn(isBpDiaryTable && idx % 2 === 1 && "bg-[#E8EDEE]/35 hover:bg-[#E8EDEE]/45")}
                          >
                        {field.columns?.map((c) => {
                          const cellRaw = String(row[c.key] ?? "");
                          const cellVal = row[c.key];
                          const v = assessTableCell(templateNameLower, c, cellVal, ageYears);
                          const hasCell = cellRaw.trim().length > 0;
                          const cellBlockMsg = auditFormatBlockForCell(formatBlockingIssues, fk, idx, c.key);
                          const pulseCol = c.type === "NUMBER" && columnLooksLikePulse(c);
                          const bpMmHgNum = c.type === "NUMBER" && columnLooksLikeBp(c);
                          const bpMmHgText =
                            (c.type === "TEXT" || c.type === "TEXTAREA") && columnLooksLikeBp(c);
                          const numOnly = c.type === "NUMBER" && !pulseCol && !bpMmHgNum;

                          if (c.type === "DATE") {
                            const dateVital = assessDateFieldValue(cellRaw);
                            const dateShowHint = hasCell && dateVital.label;
                            return (
                              <TableCell key={c.key} className="align-top py-2 text-sm max-w-[12rem]">
                                <div className="space-y-1">
                                  <Input
                                    type="date"
                                    min="1920-01-01"
                                    max="2100-12-31"
                                    readOnly={isRo}
                                    disabled={isRo}
                                    value={toIsoDateInputValue(cellRaw)}
                                    onChange={(e) => setGridCell(idx, c.key, e.target.value)}
                                    onBlur={(e) => {
                                      const raw = e.target.value;
                                      const iso = normalizeDateInputForStorage(raw);
                                      if (iso && raw.trim() !== iso) setGridCell(idx, c.key, iso);
                                    }}
                                    onPaste={(e) => {
                                      const t = e.clipboardData.getData("text/plain");
                                      const iso = normalizeDateInputForStorage(t);
                                      if (iso) {
                                        e.preventDefault();
                                        setGridCell(idx, c.key, iso);
                                      }
                                    }}
                                    aria-invalid={cellBlockMsg ? true : undefined}
                                    className={cn(
                                      "min-h-[44px] text-base touch-manipulation",
                                      isRo && "bg-muted/40 cursor-default",
                                      cellBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                                      !cellBlockMsg && dateShowHint && "border-2",
                                      !cellBlockMsg && dateShowHint && toneBorderClass(dateVital.tone)
                                    )}
                                    title={
                                      cellBlockMsg
                                        ? cellBlockMsg
                                        : dateShowHint && dateVital.label
                                          ? dateVital.label
                                          : undefined
                                    }
                                  />
                                  {cellBlockMsg ? (
                                    <p className="text-xs text-destructive leading-snug" role="status">
                                      Cannot save: {cellBlockMsg}
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                            );
                          }

                          if (c.type === "DROPDOWN" || c.type === "YES_NO") {
                            const opts = c.type === "YES_NO" ? ["Yes", "No"] : c.options ?? [];
                            const strVal = typeof cellVal === "string" && cellVal !== "" ? cellVal : undefined;
                            const cellDropdownItems = Object.fromEntries(opts.map((opt) => [opt, opt] as [string, string]));
                            return (
                              <TableCell key={c.key} className="align-top py-2 text-sm max-w-[10rem]">
                                <div className="space-y-1">
                                  <Select
                                    items={cellDropdownItems}
                                    value={strVal}
                                    disabled={isRo}
                                    onValueChange={(val) => setGridCell(idx, c.key, val ?? "")}
                                  >
                                    <SelectTrigger
                                      aria-invalid={cellBlockMsg ? true : undefined}
                                      className={cn(
                                        "min-h-[44px] w-full touch-manipulation",
                                        cellBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS
                                      )}
                                    >
                                      <SelectValue placeholder="—" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {opts.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {cellBlockMsg ? (
                                    <p className="text-xs text-destructive leading-snug" role="status">
                                      Cannot save: {cellBlockMsg}
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                            );
                          }

                          if (c.type === "TEXTAREA") {
                            return (
                              <TableCell key={c.key} className="align-top py-2 text-sm min-w-[10rem] max-w-[18rem]">
                                <div className="space-y-1">
                                  <Textarea
                                    readOnly={isRo}
                                    disabled={isRo}
                                    aria-invalid={cellBlockMsg ? true : undefined}
                                    className={cn(
                                      "min-h-[120px] text-base touch-manipulation touch-pan-y",
                                      isRo && "bg-muted/40 cursor-default",
                                      cellBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                                      !cellBlockMsg && hasCell && v.label && "border-2",
                                      !cellBlockMsg && hasCell && v.label && toneBorderClass(v.tone)
                                    )}
                                    value={cellRaw}
                                    onChange={(e) => setGridCell(idx, c.key, e.target.value)}
                                    title={
                                      cellBlockMsg
                                        ? cellBlockMsg
                                        : hasCell && v.label
                                          ? v.label
                                          : undefined
                                    }
                                  />
                                  {cellBlockMsg ? (
                                    <p className="text-xs text-destructive leading-snug" role="status">
                                      Cannot save: {cellBlockMsg}
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                            );
                          }

                          if (c.type === "NUMBER") {
                            const rangeV =
                              typeof c.normalMin === "number" && typeof c.normalMax === "number"
                                ? assessNumericRange(cellRaw, c.normalMin, c.normalMax, c.unit ?? "range")
                                : v;
                            return (
                              <TableCell key={c.key} className="align-top py-2 text-sm max-w-[10rem]">
                                <div className="space-y-1">
                                  <Input
                                    type={numOnly ? "number" : "text"}
                                    inputMode={numOnly || pulseCol ? "numeric" : undefined}
                                    {...(pulseCol ? { min: PULSE_BPM_MIN, max: PULSE_BPM_MAX, step: 1 } : {})}
                                    {...(bpMmHgNum ? { maxLength: 14, autoComplete: "off" as const } : {})}
                                    readOnly={isRo}
                                    disabled={isRo}
                                    value={cellRaw}
                                    onChange={(e) => setGridCell(idx, c.key, e.target.value)}
                                    aria-invalid={cellBlockMsg ? true : undefined}
                                    className={cn(
                                      "min-h-[44px] text-base touch-manipulation",
                                      isRo && "bg-muted/40 cursor-default",
                                      cellBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                                      !cellBlockMsg && hasCell && rangeV.label && "border-2",
                                      !cellBlockMsg && hasCell && rangeV.label && toneBorderClass(rangeV.tone)
                                    )}
                                    title={
                                      cellBlockMsg
                                        ? cellBlockMsg
                                        : hasCell && rangeV.label
                                          ? rangeV.label
                                          : undefined
                                    }
                                  />
                                  {cellBlockMsg ? (
                                    <p className="text-xs text-destructive leading-snug" role="status">
                                      Cannot save: {cellBlockMsg}
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={c.key} className="align-top py-2 text-sm max-w-[11rem]">
                              <div className="space-y-1">
                                <Input
                                  type="text"
                                  readOnly={isRo}
                                  disabled={isRo}
                                  value={cellRaw}
                                  onChange={(e) => setGridCell(idx, c.key, e.target.value)}
                                  {...(bpMmHgText ? { maxLength: 14, autoComplete: "off" as const } : {})}
                                  aria-invalid={cellBlockMsg ? true : undefined}
                                  className={cn(
                                    "min-h-[44px] text-base touch-manipulation",
                                    isRo && "bg-muted/40 cursor-default",
                                    cellBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                                    !cellBlockMsg && hasCell && v.label && "border-2",
                                    !cellBlockMsg && hasCell && v.label && toneBorderClass(v.tone)
                                  )}
                                  title={
                                    cellBlockMsg
                                      ? cellBlockMsg
                                      : hasCell && v.label
                                        ? v.label
                                        : undefined
                                  }
                                />
                                {cellBlockMsg ? (
                                  <p className="text-xs text-destructive leading-snug" role="status">
                                    Cannot save: {cellBlockMsg}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                          );
                        })}
                        {!isRo ? (
                        <TableCell className="align-top py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-[40px] touch-manipulation text-destructive hover:text-destructive"
                            onClick={() =>
                              setValues((s) => {
                                const next = [...((s[fk] as Record<string, unknown>[]) ?? [])];
                                next.splice(idx, 1);
                                return { ...s, [fk]: next };
                              })
                            }
                          >
                            Remove
                          </Button>
                        </TableCell>
                        ) : null}
                      </TableRow>
                          {timingRowMsg ? (
                            <TableRow className="border-0 hover:bg-transparent bg-destructive/5">
                              <TableCell
                                colSpan={gridColSpan}
                                className="py-2 text-sm text-destructive border-t border-destructive/25"
                              >
                                <span className="font-medium">This row cannot be saved yet: </span>
                                {timingRowMsg}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        }
        if (field.type === "DATE") {
          const dateRaw = String(values[field.key] ?? "");
          const hasDateVal = dateRaw.trim().length > 0;
          const dateVital = assessDateFieldValue(dateRaw);
          const dateShowHint = hasDateVal && dateVital.label;
          const fieldBlockMsg = auditFormatBlockForField(formatBlockingIssues, field.key);
          return (
            <div key={field.key} className="space-y-2">
              <Label className={STAFF_FIELD_LABEL}>{field.label}</Label>
              <Input
                type="date"
                min="1920-01-01"
                max="2100-12-31"
                readOnly={isRo}
                disabled={isRo}
                value={toIsoDateInputValue(dateRaw)}
                onChange={(e) => setValues((s) => ({ ...s, [field.key]: e.target.value }))}
                onBlur={() => {
                  const iso = normalizeDateInputForStorage(dateRaw);
                  if (iso && dateRaw.trim() !== iso) {
                    setValues((s) => ({ ...s, [field.key]: iso }));
                  }
                }}
                onPaste={(e) => {
                  const t = e.clipboardData.getData("text/plain");
                  const iso = normalizeDateInputForStorage(t);
                  if (iso) {
                    e.preventDefault();
                    setValues((s) => ({ ...s, [field.key]: iso }));
                  }
                }}
                aria-invalid={fieldBlockMsg ? true : undefined}
                className={cn(
                  "min-h-[44px] text-base touch-manipulation",
                  isRo && "bg-muted/40 cursor-default",
                  fieldBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                  !fieldBlockMsg && dateShowHint && "border-2",
                  !fieldBlockMsg && dateShowHint && toneBorderClass(dateVital.tone)
                )}
                title={
                  fieldBlockMsg
                    ? fieldBlockMsg
                    : dateShowHint && dateVital.label
                      ? dateVital.label
                      : undefined
                }
              />
              {fieldBlockMsg ? (
                <p className="text-xs text-destructive leading-snug" role="status">
                  Cannot save: {fieldBlockMsg}
                </p>
              ) : null}
              {!isRo ? (
              <p className="text-xs text-muted-foreground">
                Calendar, or paste UK dates — <strong>7/1/2025</strong> style is fine; we normalise when you leave the
                field.
              </p>
              ) : null}
            </div>
          );
        }
        const raw = String(values[field.key] ?? "");
        const hasVal = raw.trim().length > 0;
        const fieldBlockMsg = auditFormatBlockForField(formatBlockingIssues, field.key);
        const vitalBase =
          field.type === "NUMBER" || field.type === "TEXT" || field.type === "TEXTAREA"
            ? assessTopLevelField(templateNameLower, field, values[field.key], ageYears)
            : { tone: "neutral" as const, label: "" };
        const v =
          field.type === "NUMBER" &&
          typeof field.normalMin === "number" &&
          typeof field.normalMax === "number"
            ? assessNumericRange(raw, field.normalMin, field.normalMax, field.unit ?? "range")
            : vitalBase;
        const pulseTop = field.type === "NUMBER" && columnLooksLikePulse(field);
        const bpTopText =
          (field.type === "TEXT" || field.type === "TEXTAREA") && columnLooksLikeBp(field);
        const bpTopMmHgNumber = field.type === "NUMBER" && columnLooksLikeBp(field);
        const bpTopMmHg = bpTopText || bpTopMmHgNumber;
        const topFieldNumericOnly = field.type === "NUMBER" && !pulseTop && !bpTopMmHgNumber;
        return (
          <div key={field.key} className="space-y-2">
            <Label className={STAFF_FIELD_LABEL}>{field.label}</Label>
            {!isRo && pulseTop ? (
              <p className="text-xs text-muted-foreground">
                Whole number only — typically {PULSE_BPM_MIN}–{PULSE_BPM_MAX} bpm at rest.
              </p>
            ) : !isRo && bpTopMmHg ? (
              <p className="text-xs text-muted-foreground">
                Systolic/diastolic with a slash, e.g. <span className="font-mono text-[#005EB8]">120/80</span> mmHg.
              </p>
            ) : null}
            <Input
              type={topFieldNumericOnly ? "number" : "text"}
              inputMode={topFieldNumericOnly || pulseTop ? ("numeric" as const) : undefined}
              {...(pulseTop ? { min: PULSE_BPM_MIN, max: PULSE_BPM_MAX, step: 1 } : {})}
              {...(bpTopMmHg ? { maxLength: 14, autoComplete: "off" as const } : {})}
              readOnly={isRo}
              disabled={isRo}
              value={raw}
              onChange={(e) => setValues((s) => ({ ...s, [field.key]: e.target.value }))}
              aria-invalid={fieldBlockMsg ? true : undefined}
              className={cn(
                "min-h-[44px] text-base touch-manipulation",
                isRo && "bg-muted/40 cursor-default",
                fieldBlockMsg && SUBMIT_BLOCKING_FIELD_CLASS,
                !fieldBlockMsg && hasVal && v.label && "border-2",
                !fieldBlockMsg && hasVal && v.label && toneBorderClass(v.tone)
              )}
              title={fieldBlockMsg ? fieldBlockMsg : hasVal && v.label ? v.label : undefined}
            />
            {fieldBlockMsg ? (
              <p className="text-xs text-destructive leading-snug" role="status">
                Cannot save: {fieldBlockMsg}
              </p>
            ) : null}
          </div>
        );
      })}
      {!previewOnly ? (
        <div className="sticky bottom-0 z-10 -mx-1 mt-6 border-t border-[#005EB8]/15 bg-[#F8FAFC]/95 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm supports-[backdrop-filter]:bg-white/85 sm:static sm:z-0 sm:mx-0 sm:mt-4 sm:border-0 sm:bg-transparent sm:py-0 sm:pb-0 sm:backdrop-blur-none">
          <Button
            type="submit"
            disabled={pending}
            className="min-h-[48px] w-full max-w-none sm:max-w-sm bg-[#005EB8] hover:bg-[#004a94] touch-manipulation text-base font-semibold shadow-sm"
          >
            {pending ? "Saving…" : submitLabel}
          </Button>
        </div>
      ) : null}
    </form>

      {!previewOnly ? (
        <>
      <Dialog
        open={vitalsPlanOpen}
        onOpenChange={(open) => {
          if (!open) dismissVitalsPlan();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle className="text-[#005EB8]">Vital signs action plan</DialogTitle>
            <DialogDescription>
              Some readings are outside the age-based screening hints for this person. This is not a diagnosis — follow
              local policy and clinical advice. Choose how you will document next steps.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 max-h-[40vh] overflow-y-auto text-sm">
            {vitalsFindings.map((f, i) => (
              <li
                key={`${f.path}-${i}`}
                className={cn(
                  "rounded-lg border p-2",
                  f.level === "urgent" ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50/80"
                )}
              >
                <span className="font-medium text-slate-900">{f.path}</span>
                <p className="text-muted-foreground mt-1">{f.message}</p>
              </li>
            ))}
          </ul>
          {hasUrgent ? (
            <p className="text-xs text-red-900 font-medium">
              If the person is unwell, seek urgent clinical advice per your service policy.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Suggested rest then recheck window for raised readings: up to <strong>{maxRecheckHours}</strong> hours —
              adjust per policy.
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full touch-manipulation"
              onClick={dismissVitalsPlan}
            >
              Go back and edit
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full bg-[#007F3B] hover:bg-[#006b32] touch-manipulation"
              disabled={pending}
              onClick={() => void confirmVitalsSubmit("followup")}
            >
              {pending ? "Saving…" : "Follow-up / escalate — submit report"}
            </Button>
            <Button
              type="button"
              className="min-h-[44px] w-full bg-[#005EB8] hover:bg-[#004a94] touch-manipulation"
              disabled={pending}
              onClick={() => void confirmVitalsSubmit("recheck")}
            >
              {pending
                ? "Saving…"
                : `Rest & recheck within ${maxRecheckHours}h — submit report`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuditAiValidationWizard
        open={aiValOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPendingAiPayload(null);
            setAiValResult(null);
          }
          setAiValOpen(o);
        }}
        loading={aiValLoading}
        result={aiValResult}
        pending={pending}
        onGoBack={() => {
          setAiValOpen(false);
          setPendingAiPayload(null);
          setAiValResult(null);
        }}
        onSubmitReport={async () => {
          const p = pendingAiPayloadRef.current;
          const r = aiValResultRef.current;
          if (!p || !r || r.cannot_save) return;
          await flushSubmit(withAiMeta(p, r));
        }}
      />
        </>
      ) : null}
    </>
  );
}
