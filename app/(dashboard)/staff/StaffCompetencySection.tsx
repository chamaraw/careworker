"use client";

import { useMemo, useState } from "react";
import { useRegisterStaffAssistantPage } from "@/components/staff-assistant/staff-assistant-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { setUserCompetencyProfiles } from "./actions";
import { cn } from "@/lib/utils";

type ProfileOpt = { id: string; name: string; slug: string; description: string | null };

type CompetencyItem = {
  requirementId: string;
  name: string;
  status: string;
  completedAt: string | null;
  expiresAt: string | null;
};

function statusStyle(status: string) {
  switch (status) {
    case "VALID":
      return "text-[#007F3B]";
    case "EXPIRING":
      return "text-amber-800";
    case "EXPIRED":
    case "MISSING":
      return "text-red-700";
    default:
      return "text-muted-foreground";
  }
}

export function StaffCompetencySection({
  userId,
  allProfiles,
  selectedProfileIds,
  competencyItems,
  profileNames,
}: {
  userId: string;
  allProfiles: ProfileOpt[];
  selectedProfileIds: string[];
  competencyItems: CompetencyItem[];
  profileNames: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedProfileIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const assistantReg = useMemo(
    () => ({
      flowId: "staff_edit",
      fields: [
        {
          id: "competency_profiles",
          label: "Competency profiles",
          whatGoodLooksLike:
            "Tick every profile that matches this worker’s role (e.g. medication). They inherit linked training requirements.",
        },
      ],
      getShareablePreview: () =>
        JSON.stringify(
          {
            selectedProfileIds: Array.from(selected).sort(),
            profileNames,
          },
          null,
          2
        ),
    }),
    [selected, profileNames]
  );
  useRegisterStaffAssistantPage("staff-competency", assistantReg);

  function toggle(pid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  return (
    <div id="competency" className="rounded-lg border bg-white p-4 shadow-sm space-y-4 max-w-4xl scroll-mt-24">
      <div>
        <h2 className="text-lg font-semibold text-[#005EB8]">Competency & training</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Assign <strong className="text-foreground">competency profiles</strong> to match this worker’s role (e.g.
          medication, learning disability). They inherit all &quot;all staff&quot; requirements plus any linked to those
          profiles. Record completions under{" "}
          <Link href="/audits/workforce" className="underline text-[#005EB8] font-medium">
            Audits → Workforce compliance
          </Link>
          .
        </p>
      </div>

      {profileNames.length > 0 ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Current profiles:</span>{" "}
          <span className="font-medium text-slate-900">{profileNames.join(", ")}</span>
        </p>
      ) : (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3">
          No competency profiles assigned — only organisation-wide (&quot;all staff&quot;) requirements apply unless you
          add profiles.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Profiles</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {allProfiles.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex items-start gap-3 rounded border p-3 cursor-pointer min-h-[44px] touch-manipulation",
                selected.has(p.id) ? "border-[#005EB8] bg-[#E8F4FC]/50" : "border-border"
              )}
            >
              <input
                type="checkbox"
                className="size-4 mt-1 shrink-0"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
              />
              <span>
                <span className="font-medium text-slate-900">{p.name}</span>
                <span className="block text-xs font-mono text-muted-foreground">{p.slug}</span>
                {p.description ? (
                  <span className="block text-xs text-muted-foreground mt-1">{p.description}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        {allProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No profiles defined yet — add them under Workforce compliance.</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]"
          disabled={saving}
          onClick={async () => {
            setError("");
            setSaving(true);
            try {
              await setUserCompetencyProfiles(userId, Array.from(selected));
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save competency profiles"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Applicable training status</p>
        {competencyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active requirements apply to this worker.</p>
        ) : (
          <ul className="space-y-2 list-none m-0 p-0">
            {competencyItems.map((row) => (
              <li
                key={row.requirementId}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-[#005EB8]/10 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{row.name}</span>
                <span className={cn("font-medium", statusStyle(row.status))}>{row.status}</span>
                <span className="w-full text-xs text-muted-foreground">
                  Completed: {row.completedAt?.slice(0, 10) ?? "—"} · Renews / expires:{" "}
                  {row.expiresAt?.slice(0, 10) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
