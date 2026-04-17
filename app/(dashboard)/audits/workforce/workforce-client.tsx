"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createCompetencyProfile,
  createTrainingRequirement,
  recordTrainingCompletion,
  setCarePackageCompetencyProfiles,
  setCompetencyProfileRequirements,
} from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_COMPETENCY_RENEWAL_MONTHS, effectiveRenewalMonths } from "@/lib/staff-competency";

type ReqCol = {
  id: string;
  name: string;
  category: string | null;
  code: string | null;
  renewalMonths: number | null;
  appliesToAllStaff: boolean;
};

type MatrixRow = {
  userId: string;
  name: string;
  profileNames: string[];
  cells: Array<{
    requirementId: string;
    applicable: boolean;
    status: string;
    completedAt: string | null;
    expiresAt: string | null;
  }>;
};

type ProfileRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  linkedRequirementIds: string[];
};

type CarePkgRow = {
  id: string;
  name: string;
  slug: string;
  linkedProfileIds: string[];
};

function cellClass(status: string, applicable: boolean) {
  if (!applicable) return "bg-slate-100 text-slate-500";
  switch (status) {
    case "VALID":
      return "bg-[#ecfdf5] text-[#007F3B]";
    case "EXPIRING":
      return "bg-amber-100 text-amber-900";
    case "EXPIRED":
      return "bg-red-200 text-red-900";
    case "MISSING":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-50";
  }
}

function cellLabel(
  status: string,
  applicable: boolean,
  expiresAt: string | null,
  completedAt: string | null
) {
  if (!applicable) return "—";
  if (status === "VALID" && expiresAt) return `OK · exp ${expiresAt.slice(0, 10)}`;
  if (status === "VALID") return "OK";
  if (status === "EXPIRING") return `Due · ${expiresAt?.slice(0, 10) ?? ""}`;
  if (status === "EXPIRED") return `Expired · ${expiresAt?.slice(0, 10) ?? ""}`;
  if (status === "MISSING") return completedAt ? "Renew" : "Missing";
  return status;
}

export function WorkforceClient({
  summary,
  requirementColumns,
  rows,
  profiles,
  carePackages,
  staffOptions,
}: {
  summary: {
    users: number;
    requirements: number;
    records: number;
    expiringDocs: number;
    overdueSupervisions: number;
    competencyExpired: number;
    competencyExpiring: number;
    competencyMissing: number;
    competencyApplicableCells: number;
  };
  requirementColumns: ReqCol[];
  rows: MatrixRow[];
  profiles: ProfileRow[];
  carePackages: CarePkgRow[];
  staffOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [newReq, setNewReq] = useState("");
  const [newReqCode, setNewReqCode] = useState("");
  const [newReqCategory, setNewReqCategory] = useState("");
  const [newReqRenewal, setNewReqRenewal] = useState("");
  const [newReqAllStaff, setNewReqAllStaff] = useState(true);
  const [pending, setPending] = useState(false);

  const [matrixFilter, setMatrixFilter] = useState<"all" | "gaps">("all");

  const filteredRows = useMemo(() => {
    if (matrixFilter === "all") return rows;
    return rows.filter((r) =>
      r.cells.some(
        (c) => c.applicable && (c.status === "MISSING" || c.status === "EXPIRED" || c.status === "EXPIRING")
      )
    );
  }, [rows, matrixFilter]);

  const [completionUserId, setCompletionUserId] = useState(staffOptions[0]?.id ?? "");
  const [completionReqId, setCompletionReqId] = useState(requirementColumns[0]?.id ?? "");
  const [completionDate, setCompletionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [completionCert, setCompletionCert] = useState("");

  const [newProfileSlug, setNewProfileSlug] = useState("");
  const [newProfileName, setNewProfileName] = useState("");

  function exportCsv() {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = ["Staff", "Profiles", ...requirementColumns.map((c) => c.name)];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
      const cells = requirementColumns.map((col) => {
        const cell = r.cells.find((c) => c.requirementId === col.id);
        if (!cell?.applicable) return "n/a";
        return `${cell.status}${cell.expiresAt ? ` (${cell.expiresAt.slice(0, 10)})` : ""}`;
      });
      lines.push([r.name, r.profileNames.join("; "), ...cells].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `workforce-competency-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-[#005EB8]/20 bg-[#E8F4FC]/50 p-4 text-sm space-y-1">
        <p>
          <strong className="text-[#005EB8]">Staff:</strong> {summary.users} active ·{" "}
          <strong>Requirements:</strong> {summary.requirements} · <strong>Training records:</strong>{" "}
          {summary.records}
        </p>
        <p>
          <strong>Competency gaps (applicable cells):</strong>{" "}
          <span className="text-red-700 font-medium">{summary.competencyExpired} expired</span>
          {" · "}
          <span className="text-amber-800 font-medium">{summary.competencyExpiring} expiring ≤60d</span>
          {" · "}
          <span className="text-red-700 font-medium">{summary.competencyMissing} missing</span>
          {summary.competencyApplicableCells > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              (of {summary.competencyApplicableCells} tracked cells)
            </span>
          ) : null}
        </p>
        <p>
          <strong>Other:</strong> {summary.expiringDocs} staff docs expiring (60d) ·{" "}
          {summary.overdueSupervisions} overdue supervisions
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-[#005EB8] text-lg">Add training requirement</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
          Align names with Skills for Care statutory / mandatory topics. Use <strong>renewal (months)</strong> for
          refresher cycles; expiry is calculated from the completion date (blank renewal defaults to{" "}
          {DEFAULT_COMPETENCY_RENEWAL_MONTHS} months; enter <strong>0</strong> for no automatic expiry). Uncheck
          &quot;All staff&quot; to attach only via competency profiles below.
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-w-4xl">
          <div className="space-y-1 md:col-span-2">
            <Label>Name</Label>
            <Input value={newReq} onChange={(e) => setNewReq(e.target.value)} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Code (optional, for imports)</Label>
            <Input
              value={newReqCode}
              onChange={(e) => setNewReqCode(e.target.value)}
              placeholder="safeguarding_adults"
              className="min-h-[44px] font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Input
              value={newReqCategory}
              onChange={(e) => setNewReqCategory(e.target.value)}
              placeholder="Statutory"
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <Label>Renewal (months)</Label>
            <Input
              type="number"
              min={0}
              value={newReqRenewal}
              onChange={(e) => setNewReqRenewal(e.target.value)}
              placeholder="12"
              className="min-h-[44px]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pt-6">
            <input
              type="checkbox"
              checked={newReqAllStaff}
              onChange={(e) => setNewReqAllStaff(e.target.checked)}
              className="size-4"
            />
            Applies to all care workers
          </label>
        </div>
        <Button
          type="button"
          disabled={pending || !newReq.trim()}
          className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]"
          onClick={async () => {
            setPending(true);
            try {
              await createTrainingRequirement({
                name: newReq.trim(),
                code: newReqCode.trim() || null,
                category: newReqCategory.trim() || null,
                renewalMonths: newReqRenewal.trim() ? parseInt(newReqRenewal, 10) : null,
                appliesToAllStaff: newReqAllStaff,
              });
              setNewReq("");
              setNewReqCode("");
              setNewReqCategory("");
              setNewReqRenewal("");
              setNewReqAllStaff(true);
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Saving…" : "Add requirement"}
        </Button>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[#005EB8] text-lg">Competency matrix</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm min-h-[44px]"
              value={matrixFilter}
              onChange={(e) => setMatrixFilter(e.target.value as "all" | "gaps")}
            >
              <option value="all">All staff</option>
              <option value="gaps">Staff with gaps only</option>
            </select>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#E8EDEE]">
                <th className="border p-2 text-left sticky left-0 bg-[#E8EDEE] z-10 min-w-[8rem]">Staff</th>
                <th className="border p-2 text-left min-w-[6rem]">Profiles</th>
                {requirementColumns.map((r) => (
                  <th key={r.id} className="border p-2 text-center min-w-[5.5rem] font-medium">
                    <span className="line-clamp-3">{r.name}</span>
                    {r.renewalMonths === 0 ? (
                      <span className="block text-[10px] text-muted-foreground font-normal">No auto-expiry</span>
                    ) : (
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        {effectiveRenewalMonths(r.renewalMonths)}m{r.renewalMonths == null ? " (def.)" : ""}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((u) => (
                <tr key={u.userId}>
                  <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                    {u.name}
                    <Link
                      href={`/staff/${u.userId}/edit`}
                      className="block text-[10px] text-[#005EB8] underline mt-0.5"
                    >
                      Edit staff
                    </Link>
                  </td>
                  <td className="border p-2 text-muted-foreground">
                    {u.profileNames.length ? u.profileNames.join(", ") : "—"}
                  </td>
                  {requirementColumns.map((col) => {
                    const cell = u.cells.find((c) => c.requirementId === col.id)!;
                    return (
                      <td
                        key={col.id}
                        className={cn("border p-1 text-center align-middle", cellClass(cell.status, cell.applicable))}
                        title={
                          cell.applicable
                            ? `${cell.status} · completed ${cell.completedAt?.slice(0, 10) ?? "—"} · expires ${
                                cell.expiresAt?.slice(0, 10) ?? "—"
                              }`
                            : "Not required for this staff profile"
                        }
                      >
                        <span className="leading-tight block px-0.5">
                          {cellLabel(cell.status, cell.applicable, cell.expiresAt, cell.completedAt)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows match this filter.</p>
        ) : null}
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
        <h2 className="font-semibold text-[#005EB8] text-lg">Record training completion</h2>
        <p className="text-xs text-muted-foreground">
          Logs a completion and sets expiry from the requirement&apos;s renewal months (blank requirement uses a{" "}
          {DEFAULT_COMPETENCY_RENEWAL_MONTHS}-month default; 0 = no stored expiry).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl">
          <div className="space-y-1">
            <Label>Staff</Label>
            <select
              className="w-full rounded-md border px-3 py-2 min-h-[44px] text-sm"
              value={completionUserId}
              onChange={(e) => setCompletionUserId(e.target.value)}
            >
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Requirement</Label>
            <select
              className="w-full rounded-md border px-3 py-2 min-h-[44px] text-sm"
              value={completionReqId}
              onChange={(e) => setCompletionReqId(e.target.value)}
            >
              {requirementColumns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Completed on</Label>
            <Input
              type="date"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
          <div className="space-y-1">
            <Label>Certificate ref (optional)</Label>
            <Input
              value={completionCert}
              onChange={(e) => setCompletionCert(e.target.value)}
              className="min-h-[44px]"
            />
          </div>
        </div>
        <Button
          type="button"
          className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]"
          disabled={pending || !completionUserId || !completionReqId}
          onClick={async () => {
            setPending(true);
            try {
              await recordTrainingCompletion({
                userId: completionUserId,
                requirementId: completionReqId,
                completedAt: new Date(completionDate),
                certificateRef: completionCert.trim() || null,
              });
              router.refresh();
            } finally {
              setPending(false);
            }
          }}
        >
          Save completion
        </Button>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#005EB8] text-lg">Competency profiles</h2>
        <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
          Profiles add <strong>extra</strong> requirements beyond &quot;all staff&quot; topics. Assign profiles to each
          worker on their <Link href="/staff" className="underline text-[#005EB8]">Staff → Edit</Link> page. Link profiles
          to <strong>care packages</strong> below to show which pathway training is suggested for those service users.
        </p>
        <div className="flex flex-wrap gap-2 max-w-xl">
          <Input
            placeholder="slug e.g. medication"
            value={newProfileSlug}
            onChange={(e) => setNewProfileSlug(e.target.value)}
            className="min-h-[44px] flex-1 min-w-[8rem] font-mono text-sm"
          />
          <Input
            placeholder="Display name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="min-h-[44px] flex-1 min-w-[8rem]"
          />
          <Button
            type="button"
            variant="secondary"
            className="min-h-[44px]"
            disabled={pending || !newProfileSlug.trim() || !newProfileName.trim()}
            onClick={async () => {
              setPending(true);
              try {
                await createCompetencyProfile({
                  slug: newProfileSlug.trim(),
                  name: newProfileName.trim(),
                });
                setNewProfileSlug("");
                setNewProfileName("");
                router.refresh();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed");
              } finally {
                setPending(false);
              }
            }}
          >
            Add profile
          </Button>
        </div>
        <div className="space-y-6">
          {profiles.map((p) => (
            <ProfileRequirementEditor
              key={`${p.id}-${[...p.linkedRequirementIds].sort().join(",")}`}
              profile={p}
              requirementColumns={requirementColumns}
              pending={pending}
              setPending={setPending}
              onSaved={() => router.refresh()}
            />
          ))}
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles yet — add one above or run database seed.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
        <h2 className="font-semibold text-[#005EB8] text-lg">Care packages → suggested profiles</h2>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Informational mapping for HR (which staff profiles align with which service-user pathways). Does not auto-assign
          staff.
        </p>
        <div className="space-y-4">
          {carePackages.map((pkg) => (
            <CarePackageProfileEditor
              key={`${pkg.id}-${[...pkg.linkedProfileIds].sort().join(",")}`}
              pkg={pkg}
              profiles={profiles}
              pending={pending}
              setPending={setPending}
              onSaved={() => router.refresh()}
            />
          ))}
          {carePackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No care packages in the system.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ProfileRequirementEditor({
  profile,
  requirementColumns,
  pending,
  setPending,
  onSaved,
}: {
  profile: ProfileRow;
  requirementColumns: ReqCol[];
  pending: boolean;
  setPending: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(profile.linkedRequirementIds));
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <div className="rounded border border-[#005EB8]/15 p-3 space-y-2">
      <div className="font-medium text-slate-900">
        {profile.name}{" "}
        <span className="text-xs font-mono text-muted-foreground">({profile.slug})</span>
      </div>
      {profile.description ? <p className="text-xs text-muted-foreground">{profile.description}</p> : null}
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 max-h-48 overflow-y-auto">
        {requirementColumns.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4" />
            <span className="truncate">{r.name}</span>
          </label>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        className="min-h-[40px] bg-[#005EB8] hover:bg-[#004a94]"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await setCompetencyProfileRequirements(profile.id, Array.from(selected));
            onSaved();
          } finally {
            setPending(false);
          }
        }}
      >
        Save requirements for this profile
      </Button>
    </div>
  );
}

function CarePackageProfileEditor({
  pkg,
  profiles,
  pending,
  setPending,
  onSaved,
}: {
  pkg: CarePkgRow;
  profiles: ProfileRow[];
  pending: boolean;
  setPending: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pkg.linkedProfileIds));
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="font-medium">{pkg.name}</div>
      <div className="flex flex-wrap gap-3">
        {profiles.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="size-4" />
            {p.name}
          </label>
        ))}
      </div>
      {profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">Create competency profiles first.</p>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[40px]"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await setCarePackageCompetencyProfiles(pkg.id, Array.from(selected));
              onSaved();
            } finally {
              setPending(false);
            }
          }}
        >
          Save for this package
        </Button>
      )}
    </div>
  );
}
