"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setPropertyTemplateOptOutForServiceUser } from "@/app/(dashboard)/audits/actions";

export function CarePackageAuditAssignments({
  serviceUserId,
  templates,
  initialExcludedTemplateIds,
}: {
  serviceUserId: string;
  templates: { id: string; name: string; category: string | null }[];
  initialExcludedTemplateIds: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set(initialExcludedTemplateIds));

  const rows = useMemo(() => templates, [templates]);

  async function toggle(templateId: string) {
    const currentlyExcluded = excluded.has(templateId);
    const nextExcluded = !currentlyExcluded;
    setSaving((s) => ({ ...s, [templateId]: true }));
    try {
      // API uses "excluded" boolean. When excluded=false, we remove the override row.
      await setPropertyTemplateOptOutForServiceUser(serviceUserId, templateId, nextExcluded);
      setExcluded((prev) => {
        const n = new Set(prev);
        if (nextExcluded) n.add(templateId);
        else n.delete(templateId);
        return n;
      });
      router.refresh();
    } finally {
      setSaving((s) => ({ ...s, [templateId]: false }));
    }
  }

  return (
    <ul className="space-y-2">
      {rows.map((t) => {
        const isExcluded = excluded.has(t.id);
        const included = !isExcluded;
        return (
          <li
            key={t.id}
            className="text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-2 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {t.category ?? "—"} · {included ? "Included" : "Excluded for this person"}
              </p>
            </div>
            <Button
              type="button"
              variant={included ? "default" : "outline"}
              className={cn(
                "min-h-[40px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                included && "bg-[#005EB8] hover:bg-[#004a94] text-white"
              )}
              disabled={saving[t.id]}
              onClick={() => toggle(t.id)}
            >
              {saving[t.id] ? "Saving…" : included ? "Exclude" : "Include"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

