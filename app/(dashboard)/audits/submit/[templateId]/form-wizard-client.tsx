"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { Field } from "@/components/ui/field";
import { AiBadge } from "@/components/staff-assistant/AiBadge";
import { AiSkeleton } from "@/components/staff-assistant/AiSkeleton";
import { AiDraftCard } from "@/components/staff-assistant/AiDraftCard";
import { createFormSubmission } from "../../actions";
import { SubmitAuditFormClient } from "./submit-client";
import { applyFreshFormSmartDefaults } from "@/lib/audit-form-smart-defaults";
import { toIsoDateInputValue } from "@/lib/audit-form-dates";
import {
  auditFormValueIsEmpty,
  normalizeAuditFormPayloadForStorage,
} from "@/lib/audit-form-normalize-payload";
import { getBlockingAuditFieldIssues } from "@/lib/audit-field-vitals";
import { getTimingBlockingIssues } from "@/lib/audit-form-timing-validation";
import { getAgeYearsFromIso } from "@/lib/audit-vitals-uk-age";
import { AuditReportFilingHeader } from "@/components/audits/AuditReportFilingHeader";
import { cn } from "@/lib/utils";

type WField = {
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

type WizardQuestion = {
  id: string;
  prompt: string;
  allowMultiple: boolean;
  options: { id: string; label: string }[];
  recommendedOptionId?: string;
};

type Step =
  | { kind: "section"; label: string }
  | { kind: "info"; label: string }
  | { kind: "field"; field: WField };

const AI_FIELD_TYPES = new Set(["TEXTAREA", "YES_NO", "DROPDOWN", "NUMBER", "DATE", "TEXT"]);

function buildSteps(fields: WField[]): Step[] {
  const out: Step[] = [];
  for (const f of fields) {
    if (f.type === "SECTION_HEADER") out.push({ kind: "section", label: f.label });
    else if (f.type === "INFO_TEXT") out.push({ kind: "info", label: f.label });
    else if (f.type === "TABLE_GRID") continue;
    else out.push({ kind: "field", field: f });
  }
  return out;
}

function ageBandLabel(iso: string | null | undefined): string | undefined {
  const y = getAgeYearsFromIso(iso ?? undefined);
  if (y == null) return undefined;
  if (y < 18) return "under_18";
  if (y < 65) return "age_18_64";
  return "age_65_plus";
}

function fieldPayloadForWizard(f: WField): Record<string, unknown> {
  const base = { key: f.key, label: f.label, type: f.type };
  if (f.type === "TEXTAREA") return { ...base, options: f.options };
  if (f.type === "DROPDOWN") return { ...base, options: f.options ?? [] };
  if (f.type === "NUMBER")
    return {
      ...base,
      normalMin: f.normalMin,
      normalMax: f.normalMax,
      unit: f.unit,
    };
  return base;
}

function parseNumberStored(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Turn model output into a clear choice-group line (avoid bare field labels / statements). */
function chipGroupCaption(raw: string, fieldLabel: string): string {
  const t = raw.trim();
  const fl = fieldLabel.trim();
  if (!t || t.toLowerCase() === fl.toLowerCase()) return "What applies here?";
  if (/^(select|choose|enter|pick|state|indicate)\b/i.test(t)) {
    return "Which option applies?";
  }
  if (/\?\s*$/.test(t)) return t;
  const stripped = t.replace(/\?+$/g, "").trim();
  return `Which applies: ${stripped}?`;
}

function dedupePreserveOrder(strings: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of strings) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function truncateChipLabel(s: string, max = 56): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function variantIdFromIndex(i: number): string {
  return `s${i}`;
}

function indexFromVariantId(id: string): number | null {
  const m = /^s(\d+)$/.exec(id);
  if (!m) return null;
  return Number(m[1]);
}

export function FormWizardClient({
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
  fields: WField[];
}) {
  const router = useRouter();
  const [useFullForm, setUseFullForm] = useState(false);
  const [phase, setPhase] = useState<"wizard" | "review">("wizard");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const tableDefaults = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    for (const f of fields) {
      if (f.type === "TABLE_GRID") map[f.key] = [];
    }
    return map;
  }, [fields]);

  const steps = useMemo(() => buildSteps(fields), [fields]);
  const hasTableGrid = useMemo(() => fields.some((f) => f.type === "TABLE_GRID"), [fields]);
  const templateNameLower = useMemo(() => templateName.toLowerCase(), [templateName]);
  const ageYears = useMemo(() => getAgeYearsFromIso(patientDateOfBirthIso ?? null), [patientDateOfBirthIso]);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    let merged: Record<string, unknown> = { ...tableDefaults, ...(initialValues ?? {}) };
    merged = applyFreshFormSmartDefaults(fields, merged);
    return merged;
  });

  const [stepIntro, setStepIntro] = useState("");
  const [iqQuestions, setIqQuestions] = useState<WizardQuestion[]>([]);
  const [iqLoading, setIqLoading] = useState(false);
  const [iqSelections, setIqSelections] = useState<Record<string, string[]>>({});
  const [iqSubPhase, setIqSubPhase] = useState<"pick" | "draft">("pick");
  const [iqDraft, setIqDraft] = useState("");
  const [iqResolved, setIqResolved] = useState("");
  const [iqExtraNote, setIqExtraNote] = useState("");
  const [editWordingOpen, setEditWordingOpen] = useState(false);
  const [textareaVariants, setTextareaVariants] = useState<string[]>([]);
  const [textareaVariantPick, setTextareaVariantPick] = useState<string>("s0");
  const [aiComposedKeys, setAiComposedKeys] = useState<Set<string>>(() => new Set());

  const currentStep = phase === "wizard" ? steps[stepIndex] : null;

  const resetInterview = useCallback(() => {
    setStepIntro("");
    setIqQuestions([]);
    setIqSelections({});
    setIqSubPhase("pick");
    setIqDraft("");
    setIqResolved("");
    setIqExtraNote("");
    setEditWordingOpen(false);
    setTextareaVariants([]);
    setTextareaVariantPick("s0");
  }, []);

  useEffect(() => {
    resetInterview();
    if (!currentStep || currentStep.kind !== "field") return;
    const f = currentStep.field;
    if (!AI_FIELD_TYPES.has(f.type)) return;

    setIqLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/staff-assistant/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "questions",
            templateId,
            templateName,
            field: fieldPayloadForWizard(f),
            serviceUserContext: {
              ageBand: ageBandLabel(patientDateOfBirthIso ?? undefined),
            },
          }),
        });
        const data = (await res.json()) as {
          questions?: WizardQuestion[];
          stepIntro?: string;
          error?: string;
        };
        if (!res.ok || !data.questions?.length) {
          setIqQuestions([]);
          setStepIntro("");
        } else {
          const cleaned = data.questions.map((q) => ({
            ...q,
            prompt: chipGroupCaption(q.prompt, f.label),
          }));
          setIqQuestions(cleaned);
          setStepIntro(data.stepIntro?.trim() ?? "");
          const init: Record<string, string[]> = {};
          for (const q of cleaned) {
            if (q.recommendedOptionId && q.options.some((o) => o.id === q.recommendedOptionId)) {
              init[q.id] = [q.recommendedOptionId];
            }
          }
          setIqSelections(init);
        }
      } catch {
        setIqQuestions([]);
        setStepIntro("");
      } finally {
        setIqLoading(false);
      }
    })();
  }, [currentStep, resetInterview, templateId, templateName, patientDateOfBirthIso]);

  async function runCompose(field: WField) {
    const answers = iqQuestions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: iqSelections[q.id] ?? [],
    }));
    const res = await fetch("/api/staff-assistant/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "compose",
        templateId,
        field: fieldPayloadForWizard(field),
        answers,
        extraNote: field.type === "TEXTAREA" ? iqExtraNote.trim() || undefined : undefined,
      }),
    });
    const data = (await res.json()) as {
      draft?: string;
      alternatives?: string[];
      resolvedValue?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "Could not generate. Try again.");
      return false;
    }
    if (field.type === "TEXTAREA") {
      const d = data.draft?.trim();
      if (!d) {
        setError(data.error ?? "Could not generate text.");
        return false;
      }
      const alts = Array.isArray(data.alternatives)
        ? data.alternatives.map((x) => String(x).trim()).filter(Boolean)
        : [];
      const merged = dedupePreserveOrder([d, ...alts]).slice(0, 5);
      setTextareaVariants(merged);
      setTextareaVariantPick(variantIdFromIndex(0));
      setIqDraft(merged[0] ?? d);
    } else {
      const r = data.resolvedValue?.trim();
      if (!r) {
        setError(data.error ?? "Could not resolve value.");
        return false;
      }
      setIqResolved(r);
    }
    setAiComposedKeys((s) => new Set(s).add(field.key));
    return true;
  }

  function validateCurrentField(): boolean {
    if (!currentStep || currentStep.kind !== "field") return true;
    const f = currentStep.field;

    if (AI_FIELD_TYPES.has(f.type) && iqQuestions.length > 0) {
      if (iqSubPhase === "pick") {
        for (const q of iqQuestions) {
          const picked = iqSelections[q.id] ?? [];
          if (picked.length === 0) {
            setError(`Please pick an option under: ${q.prompt}`);
            return false;
          }
        }
        setError("");
        return true;
      }
      if (f.type === "TEXTAREA") {
        if (!iqDraft.trim()) {
          setError("Please confirm the generated text (or edit wording).");
          return false;
        }
      } else if (!iqResolved.trim()) {
        setError("Please confirm the suggested answer.");
        return false;
      }
      setError("");
      return true;
    }

    if (f.type === "TEXTAREA") {
      if (f.required && auditFormValueIsEmpty(values[f.key])) {
        setError(`Please complete ${f.label}.`);
        return false;
      }
      setError("");
      return true;
    }

    if (!f.required) {
      setError("");
      return true;
    }
    if (auditFormValueIsEmpty(values[f.key])) {
      setError(`Please complete ${f.label}.`);
      return false;
    }
    setError("");
    return true;
  }

  async function goNext() {
    if (!currentStep) return;
    if (currentStep.kind === "section" || currentStep.kind === "info") {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
      return;
    }
    const f = currentStep.field;

    if (AI_FIELD_TYPES.has(f.type) && iqQuestions.length > 0) {
      if (iqSubPhase === "pick") {
        if (!validateCurrentField()) return;
        setPending(true);
        setError("");
        const ok = await runCompose(f);
        setPending(false);
        if (!ok) return;
        setIqSubPhase("draft");
        return;
      }
      if (!validateCurrentField()) return;
      if (f.type === "TEXTAREA") {
        setValues((v) => ({ ...v, [f.key]: iqDraft.trim() }));
      } else if (f.type === "NUMBER") {
        const n = Number.parseFloat(iqResolved.trim());
        setValues((v) => ({ ...v, [f.key]: Number.isFinite(n) ? String(n) : iqResolved.trim() }));
      } else {
        setValues((v) => ({ ...v, [f.key]: iqResolved.trim() }));
      }
      resetInterview();
      if (stepIndex >= steps.length - 1) setPhase("review");
      else setStepIndex((i) => i + 1);
      return;
    }

    if (f.type === "TEXTAREA" && iqQuestions.length === 0) {
      if (f.required && auditFormValueIsEmpty(values[f.key])) {
        setError(`Please complete ${f.label}.`);
        return;
      }
      setError("");
      if (stepIndex >= steps.length - 1) setPhase("review");
      else setStepIndex((i) => i + 1);
      return;
    }

    if (!validateCurrentField()) return;
    if (stepIndex >= steps.length - 1) setPhase("review");
    else setStepIndex((i) => i + 1);
  }

  function goBack() {
    setError("");
    if (phase === "review") {
      setPhase("wizard");
      setStepIndex(Math.max(0, steps.length - 1));
      return;
    }
    if (currentStep?.kind === "field" && AI_FIELD_TYPES.has(currentStep.field.type) && iqSubPhase === "draft") {
      setIqSubPhase("pick");
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function submitFromReview() {
    setError("");
    const merged = { ...tableDefaults, ...values };
    const blocking = getBlockingAuditFieldIssues(templateNameLower, fields, merged, ageYears);
    const timingBlocking = getTimingBlockingIssues(fields, merged);
    if (blocking.length + timingBlocking.length > 0) {
      setError([...blocking, ...timingBlocking].join("\n") || "Some answers need fixing before you can save.");
      return;
    }
    if (hasTableGrid) {
      setUseFullForm(true);
      return;
    }
    for (const field of fields) {
      if (!field.required) continue;
      if (field.type === "TABLE_GRID") continue;
      if (field.type === "SECTION_HEADER" || field.type === "INFO_TEXT") continue;
      if (auditFormValueIsEmpty(merged[field.key])) {
        setError(`Please complete ${field.label}.`);
        return;
      }
    }
    setPending(true);
    try {
      const payload = normalizeAuditFormPayloadForStorage(fields, merged);
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
        __wizardSubmit: { at: submittedAt },
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setPending(false);
    }
  }

  if (useFullForm) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[#005EB8]/25 bg-[#E8F4FC]/50 p-4 space-y-2">
          <p className="text-sm font-semibold text-[#005EB8]">Full form (tables and advanced checks)</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your guided answers are pre-filled below. Complete any table sections, review, then use{" "}
            <strong className="text-foreground">Submit report</strong>.
          </p>
          <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setUseFullForm(false)}>
            Back to guided steps
          </Button>
        </div>
        <SubmitAuditFormClient
          templateId={templateId}
          propertyId={propertyId}
          serviceUserId={serviceUserId}
          templateName={templateName}
          propertyName={propertyName}
          recordedByName={recordedByName}
          aiAssistantPrompt={aiAssistantPrompt}
          patientSummary={patientSummary}
          patientDateOfBirthIso={patientDateOfBirthIso}
          initialValues={{ ...initialValues, ...values }}
          fields={fields as never[]}
        />
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-6">
        <AuditReportFilingHeader
          templateName={templateName}
          propertyName={propertyName}
          patientLine={patientSummary}
          recordedByName={recordedByName}
          mode="recording"
        />
        <h1 className="text-xl sm:text-2xl font-semibold text-[#005EB8]">Review before sending</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Check each answer. Tap <strong className="text-foreground">Edit</strong> to go back to a step, or switch to the full
          form if you need tables or extra detail.
        </p>
        {hasTableGrid ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            This form includes a <strong>table</strong>. After you tap continue, you will use the full form to complete table
            rows, then submit.
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p> : null}
        <ul className="space-y-3 list-none m-0 p-0">
          {fields.map((f) => {
            if (f.type === "SECTION_HEADER") {
              return (
                <li key={f.key} className="pt-4 text-lg font-semibold text-[#005EB8] border-t border-[#E8EDEE]">
                  {f.label}
                </li>
              );
            }
            if (f.type === "INFO_TEXT") {
              return (
                <li key={f.key} className="rounded-md border border-[#005EB8]/20 bg-[#E8F4FC]/50 px-3 py-2 text-sm">
                  {f.label}
                </li>
              );
            }
            if (f.type === "TABLE_GRID") {
              return (
                <li key={f.key} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{f.label}</span> — completed in full form (tables).
                </li>
              );
            }
            const v = values[f.key];
            const display =
              f.type === "TABLE_GRID" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v ?? "—");
            const composed = aiComposedKeys.has(f.key);
            return (
              <li
                key={f.key}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  composed ? "border-[#00A499]/40 bg-[#00A499]/5" : "border-[#E8EDEE]"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{f.label}</p>
                      {composed ? <AiBadge compact /> : null}
                    </div>
                    {composed ? (
                      <p className="text-xs font-medium text-[#007F3B]">Guided wording — review before sending</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => {
                      const idx = steps.findIndex((s) => s.kind === "field" && s.field.key === f.key);
                      if (idx >= 0) {
                        setPhase("wizard");
                        setStepIndex(idx);
                        resetInterview();
                      }
                    }}
                  >
                    Edit
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap text-slate-800">{display}</p>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={goBack}>
            Back
          </Button>
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={() => setUseFullForm(true)}>
            Switch to full form
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-[48px] bg-[#005EB8] hover:bg-[#004a93] text-white"
            disabled={pending}
            onClick={() => void submitFromReview()}
          >
            {hasTableGrid ? "Continue to full form" : pending ? "Sending…" : "Submit report"}
          </Button>
        </div>
      </div>
    );
  }

  const showAiHero =
    currentStep?.kind === "field" && AI_FIELD_TYPES.has(currentStep.field.type) && iqSubPhase === "pick";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Guided steps — AI suggests options; you confirm.{" "}
          <button
            type="button"
            className="text-[#005EB8] font-semibold underline min-h-[44px] touch-manipulation"
            onClick={() => setUseFullForm(true)}
          >
            Switch to full form
          </button>
        </p>
      </div>
      <AuditReportFilingHeader
        templateName={templateName}
        propertyName={propertyName}
        patientLine={patientSummary}
        recordedByName={recordedByName}
        mode="recording"
      />
      <div className="rounded-xl border border-[#005EB8]/20 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span className="tabular-nums">{Math.round(((stepIndex + 1) / Math.max(1, steps.length)) * 100)}%</span>
        </div>

        {showAiHero ? (
          <div className="rounded-lg border border-[#005EB8]/20 bg-gradient-to-r from-[#E8F4FC]/90 to-white px-3 py-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <span className="text-sm font-semibold text-[#005EB8]">Guided choices</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed">
              {stepIntro ||
                `Tap the answers that best match what you observed for “${currentStep.field.label}”. You can refine wording on the next screen.`}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p> : null}

        {!currentStep ? (
          <p className="text-muted-foreground">No steps.</p>
        ) : currentStep.kind === "section" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[#005EB8]">{currentStep.label}</h2>
            <Button type="button" size="lg" className="min-h-[48px] w-full bg-[#005EB8]" onClick={() => void goNext()}>
              Continue
            </Button>
          </div>
        ) : currentStep.kind === "info" ? (
          <div className="space-y-4">
            <p className="text-base text-slate-700 leading-relaxed">{currentStep.label}</p>
            <Button type="button" size="lg" className="min-h-[48px] w-full bg-[#005EB8]" onClick={() => void goNext()}>
              Continue
            </Button>
          </div>
        ) : (
          <FieldStepBody
            field={currentStep.field}
            values={values}
            setValues={setValues}
            iqQuestions={iqQuestions}
            iqLoading={iqLoading}
            iqSelections={iqSelections}
            setIqSelections={setIqSelections}
            iqSubPhase={iqSubPhase}
            iqDraft={iqDraft}
            setIqDraft={setIqDraft}
            textareaVariants={textareaVariants}
            textareaVariantPick={textareaVariantPick}
            setTextareaVariantPick={setTextareaVariantPick}
            iqResolved={iqResolved}
            iqExtraNote={iqExtraNote}
            setIqExtraNote={setIqExtraNote}
            editWordingOpen={editWordingOpen}
            setEditWordingOpen={setEditWordingOpen}
            pending={pending}
            onRefineFromDraft={() => {
              setIqSubPhase("pick");
              setEditWordingOpen(false);
            }}
            onRegenerate={() => {
              if (!currentStep || currentStep.kind !== "field") return;
              void (async () => {
                setPending(true);
                setError("");
                await runCompose(currentStep.field);
                setPending(false);
              })();
            }}
          />
        )}

        {currentStep?.kind === "field" ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-[48px]"
              onClick={goBack}
              disabled={stepIndex === 0 && iqSubPhase === "pick"}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              className="min-h-[48px] flex-1 bg-[#005EB8] hover:bg-[#004a93] text-white"
              disabled={pending || (AI_FIELD_TYPES.has(currentStep.field.type) && iqLoading && iqSubPhase === "pick")}
              onClick={() => void goNext()}
            >
              {(() => {
                const f = currentStep.field;
                if (AI_FIELD_TYPES.has(f.type) && iqQuestions.length > 0) {
                  if (iqSubPhase === "pick") return pending ? "Generating…" : "Generate answer";
                  return "Use this answer and continue";
                }
                return stepIndex >= steps.length - 1 ? "Review" : "Next";
              })()}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldStepBody({
  field,
  values,
  setValues,
  iqQuestions,
  iqLoading,
  iqSelections,
  setIqSelections,
  iqSubPhase,
  iqDraft,
  setIqDraft,
  textareaVariants,
  textareaVariantPick,
  setTextareaVariantPick,
  iqResolved,
  iqExtraNote,
  setIqExtraNote,
  editWordingOpen,
  setEditWordingOpen,
  pending,
  onRefineFromDraft,
  onRegenerate,
}: {
  field: WField;
  values: Record<string, unknown>;
  setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
  iqQuestions: WizardQuestion[];
  iqLoading: boolean;
  iqSelections: Record<string, string[]>;
  setIqSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  iqSubPhase: "pick" | "draft";
  iqDraft: string;
  setIqDraft: (s: string) => void;
  textareaVariants: string[];
  textareaVariantPick: string;
  setTextareaVariantPick: Dispatch<SetStateAction<string>>;
  iqResolved: string;
  iqExtraNote: string;
  setIqExtraNote: (s: string) => void;
  editWordingOpen: boolean;
  setEditWordingOpen: (v: boolean) => void;
  pending: boolean;
  onRefineFromDraft: () => void;
  onRegenerate: () => void;
}) {
  const cur = values[field.key];
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const yesterdayIso = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  const numberRange =
    field.type === "NUMBER" && field.normalMin != null && field.normalMax != null
      ? field.normalMax - field.normalMin
      : null;
  const showNumberSlider =
    field.type === "NUMBER" &&
    field.normalMin != null &&
    field.normalMax != null &&
    numberRange != null &&
    numberRange > 0 &&
    numberRange <= 12;

  if (AI_FIELD_TYPES.has(field.type) && iqSubPhase === "draft") {
    if (field.type === "TEXTAREA") {
      return (
        <AiDraftCard
          title={field.label}
          bodySlot={
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tap a suggested wording, or choose <strong className="text-foreground">Write my own</strong> and use the box
                below.
              </p>
              <ToggleGroup
                multiple={false}
                value={textareaVariantPick ? [textareaVariantPick] : []}
                onValueChange={(next) => {
                  const id = next.length ? next[next.length - 1]! : variantIdFromIndex(0);
                  setTextareaVariantPick(id);
                  if (id === "own") return;
                  const idx = indexFromVariantId(id);
                  if (idx != null && textareaVariants[idx]) setIqDraft(textareaVariants[idx]);
                }}
              >
                {textareaVariants.map((text, i) => (
                  <ToggleGroupItem key={variantIdFromIndex(i)} value={variantIdFromIndex(i)}>
                    {truncateChipLabel(text)}
                  </ToggleGroupItem>
                ))}
                <ToggleGroupItem value="own">Write my own</ToggleGroupItem>
              </ToggleGroup>
              <Textarea
                value={iqDraft}
                onChange={(e) => {
                  setIqDraft(e.target.value);
                  setTextareaVariantPick("own");
                }}
                className="min-h-[200px] text-base touch-pan-y"
                placeholder="Type or paste your own wording here…"
              />
            </>
          }
          pending={pending}
          onRegenerate={onRegenerate}
          onRefine={onRefineFromDraft}
          showEditWording={false}
          editWordingOpen={false}
          onToggleEditWording={() => {}}
          editWordingValue=""
          onEditWordingChange={() => {}}
        />
      );
    }
    return (
      <div className="space-y-3">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        <AiDraftCard
          title="Suggested answer"
          bodyText={iqResolved}
          pending={pending}
          onRegenerate={onRegenerate}
          onRefine={onRefineFromDraft}
          showEditWording={false}
          editWordingOpen={false}
          onToggleEditWording={() => {}}
          editWordingValue=""
          onEditWordingChange={() => {}}
        />
      </div>
    );
  }

  if (field.type === "TEXTAREA") {
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      return (
        <div className="space-y-2">
          <Field.Root>
            <Field.Label>{field.label}</Field.Label>
            <Field.Description>
              Quick choices are not available — type below or use <strong>Switch to full form</strong>.
            </Field.Description>
          </Field.Root>
          <Textarea
            value={String(values[field.key] ?? "")}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            className="min-h-[200px] text-base touch-pan-y"
            placeholder="Write a factual, dated note…"
          />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem
                  key={opt.id}
                  value={opt.id}
                  aiSuggested={opt.id === q.recommendedOptionId}
                >
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
        <div className="rounded-lg border border-[#E8EDEE] bg-white">
          <button
            type="button"
            className="flex w-full min-h-[48px] items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-[#005EB8] touch-manipulation"
            onClick={() => setEditWordingOpen(!editWordingOpen)}
          >
            Optional context for AI (brief)
            <span className="text-muted-foreground text-xs font-normal">{editWordingOpen ? "Hide" : "Show"}</span>
          </button>
          {editWordingOpen ? (
            <div className="border-t border-[#E8EDEE] p-3">
              <Input
                value={iqExtraNote}
                onChange={(e) => setIqExtraNote(e.target.value)}
                className="min-h-[48px] text-base"
                placeholder="Optional — keep brief; no names unless necessary"
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.type === "TEXT") {
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      return (
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          <Input
            className="min-h-[48px] text-base"
            value={String(cur ?? "")}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            placeholder="Short answer"
          />
        </Field.Root>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} aiSuggested={opt.id === q.recommendedOptionId}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "YES_NO") {
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      const yn = String(cur ?? "");
      return (
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          <ToggleGroup
            multiple={false}
            value={yn === "Yes" || yn === "No" ? [yn] : ([] as string[])}
            onValueChange={(next) => {
              const v = next[0];
              setValues((prev) => ({ ...prev, [field.key]: v === "Yes" || v === "No" ? v : "" }));
            }}
          >
            <ToggleGroupItem value="Yes">Yes</ToggleGroupItem>
            <ToggleGroupItem value="No">No</ToggleGroupItem>
          </ToggleGroup>
        </Field.Root>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} aiSuggested={opt.id === q.recommendedOptionId}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "DROPDOWN") {
    const opts = field.options ?? [];
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      return (
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          <ToggleGroup
            multiple={false}
            value={opts.includes(String(cur)) ? [String(cur)] : ([] as string[])}
            onValueChange={(next) => setValues((v) => ({ ...v, [field.key]: next[0] ?? "" }))}
          >
            {opts.map((o) => (
              <ToggleGroupItem key={o} value={o}>
                {o}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field.Root>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} aiSuggested={opt.id === q.recommendedOptionId}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "DATE") {
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      return (
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          <div className="flex flex-wrap gap-2 pb-2">
            <Button type="button" variant="outline" className="min-h-[48px]" onClick={() => setValues((v) => ({ ...v, [field.key]: todayIso }))}>
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[48px]"
              onClick={() => setValues((v) => ({ ...v, [field.key]: yesterdayIso }))}
            >
              Yesterday
            </Button>
          </div>
          <Input
            type="date"
            className="min-h-[48px] text-base"
            value={toIsoDateInputValue(String(cur ?? ""))}
            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
          />
        </Field.Root>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} aiSuggested={opt.id === q.recommendedOptionId}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  }

  if (field.type === "NUMBER") {
    const n = field.normalMin != null && field.normalMax != null;
    const numVal = parseNumberStored(cur);
    if (iqLoading) return <AiSkeleton />;
    if (iqQuestions.length === 0) {
      return (
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          {n ? (
            <Field.Description>
              Typical range {field.normalMin}
              {field.unit ? ` ${field.unit}` : ""} – {field.normalMax}
              {field.unit ? ` ${field.unit}` : ""} (you can still enter other values).
            </Field.Description>
          ) : null}
          {showNumberSlider && field.normalMin != null && field.normalMax != null ? (
            <Slider
              min={field.normalMin}
              max={field.normalMax}
              step={1}
              value={numVal ?? Math.round((field.normalMin + field.normalMax) / 2)}
              onValueChange={(v: number) => setValues((prev) => ({ ...prev, [field.key]: String(v) }))}
            />
          ) : null}
          <NumberField.Root
            min={field.normalMin}
            max={field.normalMax}
            step="any"
            allowOutOfRange
            value={numVal}
            onValueChange={(v: number | null) =>
              setValues((prev) => ({ ...prev, [field.key]: v == null ? "" : String(v) }))
            }
          >
            <NumberField.Group>
              <NumberField.Decrement />
              <NumberField.Input />
              <NumberField.Increment />
            </NumberField.Group>
            <NumberField.ScrubArea />
          </NumberField.Root>
        </Field.Root>
      );
    }
    return (
      <div className="space-y-5">
        <Field.Root>
          <Field.Label>{field.label}</Field.Label>
          {n ? (
            <Field.Description>
              Typical range {field.normalMin}
              {field.unit ? ` ${field.unit}` : ""} – {field.normalMax}
              {field.unit ? ` ${field.unit}` : ""}.
            </Field.Description>
          ) : null}
        </Field.Root>
        {iqQuestions.map((q) => (
          <div key={q.id} className="space-y-2">
            <p className="text-base font-medium text-slate-900">{q.prompt}</p>
            <ToggleGroup
              multiple={q.allowMultiple}
              value={(iqSelections[q.id] ?? []) as string[]}
              onValueChange={(next) =>
                setIqSelections((prev) => ({
                  ...prev,
                  [q.id]: q.allowMultiple ? [...next] : next.length ? [next[next.length - 1]!] : [],
                }))
              }
            >
              {q.options.map((opt) => (
                <ToggleGroupItem key={opt.id} value={opt.id} aiSuggested={opt.id === q.recommendedOptionId}>
                  {opt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Field.Root>
      <Field.Label>{field.label}</Field.Label>
      <Field.Description>This field type is opened in the full form.</Field.Description>
    </Field.Root>
  );
}
