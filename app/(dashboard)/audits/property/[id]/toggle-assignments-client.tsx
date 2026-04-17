"use client";

import { bulkAssignAllTemplates, togglePropertyFormAssignment } from "../../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type PropertyTemplateToggleRow = {
  id: string;
  name: string;
  /** True when a PropertyFormAssignment row exists and is active. */
  active: boolean;
  /** False until this template has been linked to the property at least once. */
  onProperty: boolean;
  assignedAt: string | null;
  assignedTemplateVersion: number;
  baseTemplateName: string | null;
  baseTemplateVersion: number | null;
  latestTemplateVersion: number;
};

export function ToggleAssignmentsClient({
  propertyId,
  templates,
  globalTemplates = [],
}: {
  propertyId: string;
  templates: PropertyTemplateToggleRow[];
  /** Organisation-wide forms (always on); shown for context only. */
  globalTemplates?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [bulkPending, setBulkPending] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      {globalTemplates.length > 0 ? (
        <div className="rounded-lg border border-[#005EB8]/20 bg-[#E8F4FC]/60 px-3 py-3 text-sm text-slate-800">
          <p className="font-semibold text-[#005EB8]">Organisation-wide forms</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            These apply at <strong className="text-foreground">every property</strong> and <strong className="text-foreground">every service user</strong> without toggling them on here. Set scope under{" "}
            <strong className="text-foreground">Audits → Templates</strong> when editing a form.
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-0.5">
            {globalTemplates.map((g) => (
              <li key={g.id}>{g.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#005EB8] text-lg">Property-scoped templates</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
            Only <strong className="text-foreground">property-scoped</strong> forms appear here. Turn a form{" "}
            <strong className="text-foreground">on</strong> for this venue so it appears in{" "}
            <strong className="text-foreground">Audit recording</strong> (with organisation-wide forms) and in{" "}
            <strong className="text-foreground">Template completion &amp; tracking</strong>.{" "}
            <strong className="text-foreground">Person-only</strong> forms (e.g. clinical extras) are assigned per service user below.
          </p>
        </div>
        {templates.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={bulkPending}
            className="min-h-[44px] touch-manipulation shrink-0"
            onClick={async () => {
              setBulkPending(true);
              try {
                await bulkAssignAllTemplates(propertyId);
                router.refresh();
              } finally {
                setBulkPending(false);
              }
            }}
          >
            {bulkPending ? "Assigning…" : "Enable all forms for this property"}
          </Button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-4">
          There are no <strong className="text-foreground">property-scoped</strong> templates in the library. Create forms under{" "}
          <strong className="text-foreground">Audits → Templates</strong> and set &quot;Assignment&quot; to{" "}
          <strong className="text-foreground">Per property</strong>, or use organisation-wide / person-only scopes as needed.
        </p>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {templates.map((a) => (
            <li key={a.id} className="rounded border border-[#005EB8]/15 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm min-w-0">
                <div className="font-medium text-slate-900">{a.name}</div>
                <div className="text-muted-foreground mt-0.5 leading-relaxed">
                  {!a.onProperty ? (
                    <span>Not linked to this property yet.</span>
                  ) : (
                    <>
                      Linked {a.assignedAt ? new Date(a.assignedAt).toLocaleDateString("en-GB") : "—"} · Snapshot
                      v{a.assignedTemplateVersion}
                      {a.baseTemplateName
                        ? ` · Based on ${a.baseTemplateName} (v${a.baseTemplateVersion ?? 1})`
                        : " · Based on original template"}
                      {a.latestTemplateVersion > a.assignedTemplateVersion
                        ? ` · Newer template available (v${a.latestTemplateVersion})`
                        : ""}
                    </>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant={a.active ? "default" : "outline"}
                className={cn(
                  "min-h-[44px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                  a.active && "bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground"
                )}
                onClick={async () => {
                  await togglePropertyFormAssignment(propertyId, a.id);
                  router.refresh();
                }}
              >
                {a.active ? "Enabled" : a.onProperty ? "Disabled" : "Add to property"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
