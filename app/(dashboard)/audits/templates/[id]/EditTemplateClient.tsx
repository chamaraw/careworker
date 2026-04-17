"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { importAuditTemplateFieldsFromJson, updateFormTemplate } from "../../actions";
import { AuditTemplateBuilder, type TemplateField } from "../../AuditTemplateBuilder";
import { AUDIT_AI_ASSISTANT_SAMPLE_PROMPT } from "@/lib/audit-ai-assistant-sample";
import type { AuditScheduleFrequency, AuditTemplateAssignmentScope } from "@prisma/client";

const FILING_OPTIONS: { value: AuditScheduleFrequency; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly (calendar month, UK)" },
  { value: "QUARTERLY", label: "Quarterly (UK calendar quarters)" },
  { value: "ANNUAL", label: "Annual (UK calendar year)" },
];

const SCOPE_OPTIONS: { value: AuditTemplateAssignmentScope; label: string; hint: string }[] = [
  {
    value: "GLOBAL",
    label: "Organisation-wide (all properties & service users)",
    hint: "Always appears in recording. Not toggled per property.",
  },
  {
    value: "PROPERTY",
    label: "Per property",
    hint: "Managers enable each form per venue. Optional per-person exclusion on the property page.",
  },
  {
    value: "SERVICE_USER",
    label: "Per service user only",
    hint: "e.g. blood monitoring for selected patients only. Assign on the property → service user panel.",
  },
  {
    value: "CARE_PACKAGE",
    label: "Care package",
    hint: "Included when a service user’s profile uses a care package that links this template (Audits → Care packages). Can be excluded per person on the property page.",
  },
];

export function EditTemplateClient({
  id,
  name,
  category,
  templateCode,
  aiAssistantPrompt,
  fields,
  assignmentScope,
  filingFrequency,
  monthlyFilingDueDay,
  templateVersion,
}: {
  id: string;
  name: string;
  category: string;
  templateCode: string;
  aiAssistantPrompt: string;
  fields: TemplateField[];
  assignmentScope: AuditTemplateAssignmentScope;
  filingFrequency: AuditScheduleFrequency;
  monthlyFilingDueDay: number | null;
  templateVersion: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(name);
  const [cat, setCat] = useState(category);
  const [code, setCode] = useState(templateCode);
  const [aiPrompt, setAiPrompt] = useState(aiAssistantPrompt);
  const [importJson, setImportJson] = useState("");
  const [importPending, setImportPending] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scope, setScope] = useState<AuditTemplateAssignmentScope>(assignmentScope);
  const [filing, setFiling] = useState<AuditScheduleFrequency>(filingFrequency);
  const [monthlyDay, setMonthlyDay] = useState<string>(
    monthlyFilingDueDay != null ? String(monthlyFilingDueDay) : ""
  );

  useEffect(() => {
    setAiPrompt(aiAssistantPrompt);
  }, [aiAssistantPrompt]);

  useEffect(() => {
    setTitle(name);
    setCat(category);
    setCode(templateCode);
    setScope(assignmentScope);
    setFiling(filingFrequency);
    setMonthlyDay(monthlyFilingDueDay != null ? String(monthlyFilingDueDay) : "");
  }, [name, category, templateCode, assignmentScope, filingFrequency, monthlyFilingDueDay]);

  return (
    <div className="space-y-4">
      <div className="rounded border p-4 space-y-2 max-w-xl">
        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <p className="text-xs text-muted-foreground">
          Published version <strong className="text-foreground">{templateVersion}</strong> — bumps when structure or
          compliance metadata changes; assignments follow the latest version automatically.
        </p>
        <div className="space-y-1"><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Category</Label><Input value={cat} onChange={(e) => setCat(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Assignment</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
            value={scope}
            onChange={(e) => setScope(e.target.value as AuditTemplateAssignmentScope)}
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {SCOPE_OPTIONS.find((o) => o.value === scope)?.hint}
          </p>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label>Filing frequency (compliance)</Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Drives the Audit manager &ldquo;Upcoming filings&rdquo; view. Monthly uses UK calendar months; leave day
            blank to treat the whole month (due by last day).
          </p>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
            value={filing}
            onChange={(e) => setFiling(e.target.value as AuditScheduleFrequency)}
          >
            {FILING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {filing === "MONTHLY" ? (
            <div className="space-y-1">
              <Label htmlFor="monthly-due-day">Due by day of month (optional, 1–28)</Label>
              <Input
                id="monthly-due-day"
                type="number"
                min={1}
                max={28}
                placeholder="e.g. 15 — leave empty for end of month"
                value={monthlyDay}
                onChange={(e) => setMonthlyDay(e.target.value)}
                className="text-base max-w-xs"
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label>Template code (optional)</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono text-sm"
            placeholder="e.g. medication_round_audit"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stable id for pack sync and imports. Leave empty for one-off templates. Use letters, numbers, and underscores
            only; must be unique when set.
          </p>
        </div>
        <div className="space-y-2 pt-2 border-t">
          <div className="space-y-1">
            <Label>AI validation instructions (optional)</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Shown only on the server to guide <strong>automatic validation</strong> of submitted forms (no chat). Do not
              paste real patient details here — describe what good entries look like and any policy checks. The model
              receives a redacted payload without names or DOB.
            </p>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="min-h-[160px] text-sm touch-manipulation input-text-base"
              placeholder="Optional. Use “Insert sample prompt” for a BP-style validation example, then edit for your template."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="touch-manipulation"
              onClick={() => setAiPrompt(AUDIT_AI_ASSISTANT_SAMPLE_PROMPT)}
            >
              Insert sample prompt
            </Button>
          </div>
        </div>
        <Button
          type="button"
          disabled={savingMeta}
          onClick={async () => {
            setSavingMeta(true);
            setError("");
            setMessage("");
            try {
              let monthlyParsed: number | null = null;
              if (filing === "MONTHLY") {
                const t = monthlyDay.trim();
                if (t !== "") {
                  monthlyParsed = parseInt(t, 10);
                  if (!Number.isFinite(monthlyParsed) || monthlyParsed < 1 || monthlyParsed > 28) {
                    throw new Error("Monthly due day must be between 1 and 28, or leave blank.");
                  }
                }
              }
              await updateFormTemplate(id, {
                name: title,
                category: cat || null,
                templateCode: code.trim() || null,
                aiAssistantPrompt: aiPrompt.trim() || null,
                assignmentScope: scope,
                filingFrequency: filing,
                monthlyFilingDueDay: filing === "MONTHLY" ? monthlyParsed : null,
              });
              setMessage("Template details saved.");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to save template details.");
            } finally {
              setSavingMeta(false);
            }
          }}
        >
          {savingMeta ? "Saving..." : "Save details"}
        </Button>
      </div>

      <div className="rounded border border-[#005EB8]/25 bg-[#E8F4FC]/40 p-4 space-y-3 max-w-3xl">
        <h2 className="text-base font-semibold text-[#005EB8]">Import / export fields</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Export the field schema as JSON for version control or editing elsewhere. Import replaces all fields on this
          template (validated before save). This does not change name, category, or AI instructions until you save
          those separately.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="touch-manipulation min-h-[44px]"
            onClick={() => {
              const blob = new Blob([JSON.stringify(fields, null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              const safe = title.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "template";
              a.href = URL.createObjectURL(blob);
              a.download = `audit-fields_${safe}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Download fields JSON
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="import-fields-json">Paste fields JSON (array of field objects)</Label>
          <Textarea
            id="import-fields-json"
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            className="min-h-[200px] font-mono text-sm touch-manipulation input-text-base touch-pan-y"
            placeholder='[ { "key": "notes", "label": "Notes", "type": "TEXTAREA", "required": true } ]'
          />
          <Button
            type="button"
            variant="default"
            className="touch-manipulation min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]"
            disabled={importPending || !importJson.trim()}
            onClick={async () => {
              setImportPending(true);
              setError("");
              setMessage("");
              try {
                await importAuditTemplateFieldsFromJson(id, importJson);
                setMessage("Fields imported from JSON.");
                setImportJson("");
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Import failed.");
              } finally {
                setImportPending(false);
              }
            }}
          >
            {importPending ? "Applying…" : "Apply import (replace fields)"}
          </Button>
        </div>
      </div>

      <AuditTemplateBuilder
        templateName={title}
        initial={fields}
        onSave={async (nextFields) => {
          setSavingFields(true);
          setError("");
          setMessage("");
          try {
            await updateFormTemplate(id, { fields: nextFields as unknown as object });
            setMessage("Template fields saved.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to save template fields.");
          } finally {
            setSavingFields(false);
          }
        }}
        saving={savingFields}
      />
    </div>
  );
}
