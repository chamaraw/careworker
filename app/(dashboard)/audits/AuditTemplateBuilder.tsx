"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditFormRenderer } from "./AuditFormRenderer";

/** Column definition for TABLE_GRID fields (matches AuditFormRenderer expectations). */
export type TemplateGridColumn = {
  key: string;
  label: string;
  type: string;
  options?: string[];
  normalMin?: number;
  normalMax?: number;
  unit?: string;
};

export type TemplateField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  columns?: TemplateGridColumn[];
  defaultRows?: number;
};

const FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "YES_NO",
  "DROPDOWN",
  "TABLE_GRID",
  "SECTION_HEADER",
  "INFO_TEXT",
];

/** Column types allowed inside a table (no nested TABLE_GRID). */
const COLUMN_TYPES = ["TEXT", "TEXTAREA", "NUMBER", "DATE", "YES_NO", "DROPDOWN"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseOptionsCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionsToCsv(opts: string[] | undefined): string {
  return (opts ?? []).join(", ");
}

const defaultColumn = (): TemplateGridColumn => ({
  key: `col_${Date.now()}`,
  label: "Column",
  type: "TEXT",
});

export function AuditTemplateBuilder({
  initial,
  onSave,
  saving,
  templateName = "Template",
}: {
  initial: TemplateField[];
  onSave: (fields: TemplateField[]) => Promise<void>;
  saving?: boolean;
  /** Used for the live form preview title (e.g. template name from the edit page). */
  templateName?: string;
}) {
  const normalizeInitial = (list: TemplateField[]): TemplateField[] =>
    list.map((f) => {
      if (f.type === "TABLE_GRID" && (!Array.isArray(f.columns) || f.columns.length === 0)) {
        return { ...f, columns: [defaultColumn()] };
      }
      return { ...f };
    });

  const initialSchemaKey = useMemo(() => JSON.stringify(initial), [initial]);
  const [fields, setFields] = useState<TemplateField[]>(() => normalizeInitial(initial));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setFields(normalizeInitial(initial));
    // initialSchemaKey tracks field schema; including `initial` would fight stringify stability
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset builder when server `initial` JSON changes
  }, [initialSchemaKey]);

  async function save() {
    setPending(true);
    try {
      await onSave(fields);
    } finally {
      setPending(false);
    }
  }

  function patchField(idx: number, patch: Partial<TemplateField>) {
    setFields((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function setFieldType(idx: number, value: string) {
    setFields((prev) => {
      const cur = prev[idx];
      if (!cur) return prev;
      const next = [...prev];
      let updated: TemplateField = { ...cur, type: value };
      if (value === "TABLE_GRID") {
        updated = {
          ...updated,
          columns:
            Array.isArray(cur.columns) && cur.columns.length > 0
              ? cur.columns
              : [defaultColumn(), { ...defaultColumn(), key: `col_${Date.now()}_2`, label: "Column 2" }],
          options: undefined,
        };
      } else if (value === "DROPDOWN") {
        updated = {
          ...updated,
          columns: undefined,
          options: cur.options?.length ? cur.options : ["Option A", "Option B"],
        };
      } else {
        updated = { ...updated, columns: undefined };
        if (value === "YES_NO") {
          updated.options = cur.options?.length ? cur.options : ["Yes", "No"];
        } else {
          updated.options = undefined;
        }
      }
      if (value === "SECTION_HEADER" || value === "INFO_TEXT") {
        updated = { ...updated, required: false, options: undefined, columns: undefined };
      }
      next[idx] = updated;
      return next;
    });
  }

  const previewTitle = templateName.trim() || "Untitled template";

  return (
    <div className="space-y-6">
    <div className="space-y-3">
      {fields.map((field, idx) => (
        <div key={`${field.key}-${idx}`} className="rounded border p-3 space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={field.label}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = {
                    ...field,
                    label: e.target.value,
                    key: slugify(e.target.value || field.key),
                  };
                  setFields(next);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Key</Label>
              <Input
                value={field.key}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = { ...field, key: slugify(e.target.value) };
                  setFields(next);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={field.type} onValueChange={(v) => setFieldType(idx, v ?? field.type)}>
                <SelectTrigger className="min-h-[44px] w-full touch-manipulation">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {field.type !== "SECTION_HEADER" && field.type !== "INFO_TEXT" ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm touch-manipulation cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-[#005EB8]"
                  checked={!!field.required}
                  onChange={(e) => patchField(idx, { required: e.target.checked })}
                />
                <span>Required</span>
              </label>
            </div>
          ) : null}

          {field.type === "DROPDOWN" || field.type === "YES_NO" ? (
            <div className="space-y-1">
              <Label>Options (comma-separated)</Label>
              <Input
                className="min-h-[44px] text-base touch-manipulation"
                value={optionsToCsv(field.options)}
                onChange={(e) => {
                  const opts = parseOptionsCsv(e.target.value);
                  patchField(idx, { options: opts.length ? opts : field.type === "YES_NO" ? ["Yes", "No"] : [] });
                }}
                placeholder={field.type === "YES_NO" ? "Yes, No" : "e.g. AM, PM"}
              />
              <p className="text-xs text-muted-foreground">
                {field.type === "YES_NO"
                  ? "Defaults to Yes, No if left empty after save."
                  : "Each value becomes a dropdown choice."}
              </p>
            </div>
          ) : null}

          {field.type === "TABLE_GRID" ? (
            <div className="space-y-2 rounded-lg border border-[#005EB8]/20 bg-[#E8F4FC]/30 p-3">
              <p className="text-sm font-semibold text-[#005EB8]">Table columns</p>
              <p className="text-xs text-muted-foreground">
                Define one column per cell type. Use DROPDOWN with options like <strong>AM, PM</strong> for period.
              </p>
              <div className="space-y-3">
                {(field.columns ?? []).map((col, cIdx) => (
                  <div
                    key={`${col.key}-${cIdx}`}
                    className="rounded border bg-white p-2 space-y-2"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Column label</Label>
                        <Input
                          value={col.label}
                          onChange={(e) => {
                            const cols = [...(field.columns ?? [])];
                            cols[cIdx] = {
                              ...col,
                              label: e.target.value,
                              key: slugify(e.target.value || col.key),
                            };
                            patchField(idx, { columns: cols });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Key</Label>
                        <Input
                          value={col.key}
                          onChange={(e) => {
                            const cols = [...(field.columns ?? [])];
                            cols[cIdx] = { ...col, key: slugify(e.target.value) };
                            patchField(idx, { columns: cols });
                          }}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                        <Label className="text-xs">Column type</Label>
                        <Select
                          value={col.type}
                          onValueChange={(v) => {
                            const cols = [...(field.columns ?? [])];
                            const t = v ?? "TEXT";
                            cols[cIdx] = {
                              ...col,
                              type: t,
                              options:
                                t === "DROPDOWN" || t === "YES_NO"
                                  ? col.options?.length
                                    ? col.options
                                    : t === "YES_NO"
                                      ? ["Yes", "No"]
                                      : ["A", "B"]
                                  : undefined,
                              normalMin: t === "NUMBER" ? col.normalMin : undefined,
                              normalMax: t === "NUMBER" ? col.normalMax : undefined,
                              unit: t === "NUMBER" ? col.unit : undefined,
                            };
                            patchField(idx, { columns: cols });
                          }}
                        >
                          <SelectTrigger className="min-h-[40px] w-full touch-manipulation">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {COLUMN_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(col.type === "DROPDOWN" || col.type === "YES_NO") && (
                      <div className="space-y-1">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          value={optionsToCsv(col.options)}
                          onChange={(e) => {
                            const cols = [...(field.columns ?? [])];
                            const opts = parseOptionsCsv(e.target.value);
                            cols[cIdx] = {
                              ...col,
                              options: opts.length ? opts : col.type === "YES_NO" ? ["Yes", "No"] : [],
                            };
                            patchField(idx, { columns: cols });
                          }}
                        />
                      </div>
                    )}
                    {col.type === "NUMBER" && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Normal min</Label>
                          <Input
                            type="number"
                            value={col.normalMin ?? ""}
                            onChange={(e) => {
                              const cols = [...(field.columns ?? [])];
                              const v = e.target.value;
                              cols[cIdx] = {
                                ...col,
                                normalMin: v === "" ? undefined : Number(v),
                              };
                              patchField(idx, { columns: cols });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Normal max</Label>
                          <Input
                            type="number"
                            value={col.normalMax ?? ""}
                            onChange={(e) => {
                              const cols = [...(field.columns ?? [])];
                              const v = e.target.value;
                              cols[cIdx] = {
                                ...col,
                                normalMax: v === "" ? undefined : Number(v),
                              };
                              patchField(idx, { columns: cols });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit</Label>
                          <Input
                            value={col.unit ?? ""}
                            onChange={(e) => {
                              const cols = [...(field.columns ?? [])];
                              cols[cIdx] = { ...col, unit: e.target.value || undefined };
                              patchField(idx, { columns: cols });
                            }}
                            placeholder="mmHg"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="touch-manipulation"
                        onClick={() => {
                          const cols = [...(field.columns ?? [])];
                          cols.splice(cIdx, 1);
                          patchField(idx, { columns: cols.length ? cols : [defaultColumn()] });
                        }}
                      >
                        Remove column
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={cIdx === 0}
                        onClick={() => {
                          const cols = [...(field.columns ?? [])];
                          if (cIdx === 0) return;
                          [cols[cIdx - 1], cols[cIdx]] = [cols[cIdx], cols[cIdx - 1]];
                          patchField(idx, { columns: cols });
                        }}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={cIdx === (field.columns?.length ?? 0) - 1}
                        onClick={() => {
                          const cols = [...(field.columns ?? [])];
                          if (cIdx >= cols.length - 1) return;
                          [cols[cIdx + 1], cols[cIdx]] = [cols[cIdx], cols[cIdx + 1]];
                          patchField(idx, { columns: cols });
                        }}
                      >
                        Down
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="touch-manipulation"
                onClick={() => {
                  const cols = [...(field.columns ?? []), defaultColumn()];
                  patchField(idx, { columns: cols });
                }}
              >
                Add column
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = [...fields];
                next.splice(idx, 1);
                setFields(next);
              }}
            >
              Remove field
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={idx === 0}
              className="touch-manipulation min-h-[40px]"
              onClick={() => {
                if (idx === 0) return;
                const next = [...fields];
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                setFields(next);
              }}
            >
              Up
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={idx === fields.length - 1}
              className="touch-manipulation min-h-[40px]"
              onClick={() => {
                if (idx === fields.length - 1) return;
                const next = [...fields];
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                setFields(next);
              }}
            >
              Down
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setFields((s) => [
            ...s,
            { key: `field_${s.length + 1}`, label: "New field", type: "TEXT", required: false },
          ])
        }
      >
        Add field
      </Button>
      <Button type="button" onClick={save} disabled={pending || !!saving}>
        {pending || saving ? "Saving..." : "Save template"}
      </Button>
    </div>

      <Card className="border-2 border-[#005EB8]/25 overflow-hidden shadow-sm">
        <CardHeader className="bg-[#E8F4FC]/80 border-b border-[#005EB8]/15 py-4 space-y-1">
          <CardTitle className="text-lg text-[#005EB8]">Form preview</CardTitle>
          <p className="text-sm text-muted-foreground font-normal leading-relaxed">
            Staff-facing layout updates as you change fields above. Try inputs and table rows here; nothing is saved from
            this section.
          </p>
        </CardHeader>
        <CardContent className="pt-4 max-h-[min(85vh,920px)] overflow-y-auto">
          <AuditFormRenderer
            previewOnly
            templateName={previewTitle}
            fields={fields}
            onSubmit={async () => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}
