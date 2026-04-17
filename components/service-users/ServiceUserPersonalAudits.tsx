"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setServiceUserPersonalTemplateActive } from "@/app/(dashboard)/audits/actions";

export function ServiceUserPersonalAudits({
  serviceUserId,
  templates,
  initialAssignedTemplateIds,
}: {
  serviceUserId: string;
  templates: { id: string; name: string; category: string | null }[];
  initialAssignedTemplateIds: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(initialAssignedTemplateIds));
  const rows = useMemo(() => templates, [templates]);

  async function toggle(templateId: string) {
    const nextActive = !assigned.has(templateId);
    setSaving((s) => ({ ...s, [templateId]: true }));
    try {
      await setServiceUserPersonalTemplateActive(serviceUserId, templateId, nextActive);
      setAssigned((prev) => {
        const n = new Set(prev);
        if (nextActive) n.add(templateId);
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
        const on = assigned.has(t.id);
        return (
          <li
            key={t.id}
            className="text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-2 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.category ?? "—"} · {on ? "Assigned" : "Not assigned"}</p>
            </div>
            <Button
              type="button"
              variant={on ? "default" : "outline"}
              className={cn(
                "min-h-[40px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                on && "bg-[#005EB8] hover:bg-[#004a94] text-white"
              )}
              disabled={saving[t.id]}
              onClick={() => toggle(t.id)}
            >
              {saving[t.id] ? "Saving…" : on ? "Remove" : "Assign"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

