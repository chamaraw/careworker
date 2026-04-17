"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuditTemplateAssignmentScope } from "@prisma/client";
import {
  createCarePackage,
  updateCarePackage,
  updateCarePackageTemplateLinks,
} from "./care-package-actions";

type PackageRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  linkedTemplateIds: string[];
};

type TemplateOpt = { id: string; name: string; category: string | null; assignmentScope: AuditTemplateAssignmentScope };

export function CarePackagesAdminClient({
  packages,
  linkableTemplates,
}: {
  packages: PackageRow[];
  linkableTemplates: TemplateOpt[];
}) {
  const router = useRouter();
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [newIsActive, setNewIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectionByPackage, setSelectionByPackage] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const p of packages) {
      init[p.id] = new Set(p.linkedTemplateIds);
    }
    return init;
  });
  const [editByPackage, setEditByPackage] = useState<
    Record<
      string,
      { slug: string; name: string; description: string; sortOrder: string; isActive: boolean }
    >
  >(() => {
    const init: Record<string, { slug: string; name: string; description: string; sortOrder: string; isActive: boolean }> = {};
    for (const p of packages) {
      init[p.id] = {
        slug: p.slug,
        name: p.name,
        description: p.description ?? "",
        sortOrder: String(p.sortOrder ?? 0),
        isActive: p.isActive,
      };
    }
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePackageId, setActivePackageId] = useState<string>(() => packages[0]?.id ?? "");
  const [templateQuery, setTemplateQuery] = useState("");

  /** Always read the latest tick selection at click time (avoids stale closure with server actions). */
  const selectionRef = useRef(selectionByPackage);
  selectionRef.current = selectionByPackage;

  const templateList = useMemo(() => linkableTemplates, [linkableTemplates]);

  /** When server-linked template IDs change (e.g. after save + refresh), reset tick state from the server. */
  const linkedTemplatesFingerprint = useMemo(
    () => packages.map((p) => `${p.id}:${[...p.linkedTemplateIds].sort().join(",")}`).join("|"),
    [packages]
  );

  useEffect(() => {
    setSelectionByPackage(() => {
      const next: Record<string, Set<string>> = {};
      for (const p of packages) {
        next[p.id] = new Set(p.linkedTemplateIds);
      }
      return next;
    });
    // Intentionally depend only on fingerprint so a new `packages` array reference alone does not wipe tick state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `packages` is read from the closure when the fingerprint changes
  }, [linkedTemplatesFingerprint]);

  /** Merge new packages into edit form state without clobbering in-progress edits for existing ids. */
  useEffect(() => {
    setEditByPackage((prev) => {
      const next = { ...prev };
      for (const p of packages) {
        if (!next[p.id]) {
          next[p.id] = {
            slug: p.slug,
            name: p.name,
            description: p.description ?? "",
            sortOrder: String(p.sortOrder ?? 0),
            isActive: p.isActive,
          };
        }
      }
      return next;
    });
  }, [packages]);

  useEffect(() => {
    if (packages.length === 0) {
      setActivePackageId("");
      return;
    }
    if (!activePackageId || !packages.some((p) => p.id === activePackageId)) {
      setActivePackageId(packages[0].id);
    }
  }, [packages, activePackageId]);

  const activePackage = useMemo(
    () => packages.find((p) => p.id === activePackageId) ?? null,
    [packages, activePackageId]
  );

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return templateList;
    return templateList.filter((t) => {
      const hay = `${t.name} ${t.category ?? ""} ${t.assignmentScope}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templateList, templateQuery]);

  const selectedForActive = activePackageId ? (selectionByPackage[activePackageId] ?? new Set()) : new Set<string>();
  const selectedTemplateRows = useMemo(() => {
    if (!activePackageId) return [];
    const sel = selectionByPackage[activePackageId] ?? new Set<string>();
    const byId = new Map(templateList.map((t) => [t.id, t]));
    return Array.from(sel)
      .map((id) => byId.get(id))
      .filter((t): t is TemplateOpt => Boolean(t))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activePackageId, selectionByPackage, templateList]);

  function toggle(pkgId: string, templateId: string) {
    setSelectionByPackage((prev) => {
      const next = { ...prev };
      const cur = new Set(next[pkgId] ?? []);
      if (cur.has(templateId)) cur.delete(templateId);
      else cur.add(templateId);
      next[pkgId] = cur;
      return next;
    });
  }

  async function saveLinkedAudits(pkgId: string) {
    setError(null);
    setSaving(pkgId);
    try {
      const ids = Array.from(selectionRef.current[pkgId] ?? []);
      const result = await updateCarePackageTemplateLinks(pkgId, ids);
      toast.success(
        `Saved ${result.linkedCount} linked audit${result.linkedCount === 1 ? "" : "s"} for this care package.`
      );
      await router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  }

  function setEditField(pkgId: string, patch: Partial<{ slug: string; name: string; description: string; sortOrder: string; isActive: boolean }>) {
    setEditByPackage((prev) => ({ ...prev, [pkgId]: { ...(prev[pkgId] ?? { slug: "", name: "", description: "", sortOrder: "0", isActive: true }), ...patch } }));
  }

  async function savePackageDetails(pkgId: string) {
    setError(null);
    setSaving(pkgId);
    try {
      const row = packages.find((p) => p.id === pkgId);
      const e =
        editByPackage[pkgId] ??
        (row
          ? {
              slug: row.slug,
              name: row.name,
              description: row.description ?? "",
              sortOrder: String(row.sortOrder ?? 0),
              isActive: row.isActive,
            }
          : null);
      if (!e) {
        throw new Error("Could not read package details to save. Refresh the page and try again.");
      }
      await updateCarePackage(pkgId, {
        slug: e.slug,
        name: e.name,
        description: e.description.trim() ? e.description : null,
        sortOrder: Number.isFinite(Number(e.sortOrder)) ? Number(e.sortOrder) : 0,
        isActive: e.isActive,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  async function createNewPackage() {
    setError(null);
    setCreating(true);
    try {
      const created = await createCarePackage({
        slug: newSlug,
        name: newName,
        description: newDescription.trim() ? newDescription : null,
        sortOrder: Number.isFinite(Number(newSortOrder)) ? Number(newSortOrder) : 0,
        isActive: newIsActive,
      });
      setSelectionByPackage((prev) => ({
        ...prev,
        [created.id]: prev[created.id] ?? new Set<string>(),
      }));
      setEditByPackage((prev) => ({
        ...prev,
        [created.id]: {
          slug: newSlug.trim().toLowerCase(),
          name: newName.trim(),
          description: newDescription,
          sortOrder: String(Number.isFinite(Number(newSortOrder)) ? Number(newSortOrder) : 0),
          isActive: newIsActive,
        },
      }));
      setActivePackageId(created.id);
      setNewSlug("");
      setNewName("");
      setNewDescription("");
      setNewSortOrder("0");
      setNewIsActive(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <details className="rounded-lg border bg-white p-4 shadow-sm group">
        <summary className="cursor-pointer list-none font-semibold text-[#005EB8] text-lg flex items-center justify-between gap-2 min-h-[44px] touch-manipulation">
          <span>Create a new care package</span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">Tap to expand</span>
          <span className="text-xs font-normal text-muted-foreground hidden group-open:inline">Tap to collapse</span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Create the pathway first, then select it on the left and attach audits on the right.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Slug (lowercase, hyphens)</span>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="supported-living"
                className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                disabled={creating}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Supported living"
                className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                disabled={creating}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Description (optional)</span>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Who this package is for and what audits it drives…"
                className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                disabled={creating}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Sort order</span>
              <input
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                inputMode="numeric"
                className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                disabled={creating}
              />
            </label>
            <label className="flex items-center gap-2 text-sm min-h-[44px]">
              <input
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="size-4"
                disabled={creating}
              />
              Active (available on service user profiles)
            </label>
          </div>
          <Button
            type="button"
            className="min-h-[44px] touch-manipulation bg-[#005EB8] hover:bg-[#004a94]"
            disabled={creating}
            onClick={createNewPackage}
          >
            {creating ? "Creating…" : "Create care package"}
          </Button>
        </div>
      </details>

      {templateList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#005EB8]/25 bg-[#E8F4FC]/40 p-4 text-sm text-muted-foreground">
          No <strong className="text-slate-800">per-property</strong> or <strong className="text-slate-800">care-package</strong> templates exist yet. Create templates under{" "}
          <strong className="text-slate-800">Audits → Templates</strong> (assignment: Per property or Care package).
        </div>
      ) : null}

      <div className="rounded-lg border border-[#005EB8]/15 bg-[#E8F4FC]/40 px-4 py-3 text-sm text-slate-800 space-y-2">
        <p className="font-semibold text-[#005EB8]">How this screen works</p>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground leading-relaxed">
          <li>
            <span className="text-foreground font-medium">Pick a care package</span> in the left column.
          </li>
          <li>
            <span className="text-foreground font-medium">Tick audits</span> in the library to attach them to that package only.
          </li>
          <li>
            Use <span className="text-foreground font-medium">Selected for this package</span> to review what you have ticked before saving.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-slate-900">Per-property</strong> audits still need enabling per venue under <strong className="text-slate-900">Audits → Property</strong>.{" "}
          <strong className="text-slate-900">Organisation-wide</strong> forms do not need attaching here. <strong className="text-slate-900">Person-only</strong> extras are assigned on the service user profile.
        </p>
        <Button type="button" variant="outline" className="min-h-[44px] touch-manipulation bg-white" onClick={() => router.push("/audits/templates")}>
          Open templates library
        </Button>
      </div>

      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">No care packages yet — create one above.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
          <aside className="rounded-lg border bg-white p-3 shadow-sm lg:sticky lg:top-4 space-y-2">
            <p className="text-sm font-semibold text-[#005EB8] px-1">Care packages</p>
            <div className="max-h-[60vh] overflow-y-auto rounded border border-[#005EB8]/15 divide-y divide-[#005EB8]/10">
              {packages.map((pkg) => {
                const n = selectionByPackage[pkg.id]?.size ?? 0;
                const active = activePackageId === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setActivePackageId(pkg.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 min-h-[52px] touch-manipulation flex flex-col gap-0.5",
                      active ? "bg-[#E8F4FC] text-[#005EB8]" : "bg-white hover:bg-muted/40"
                    )}
                  >
                    <span className="font-semibold truncate">{pkg.name}</span>
                    <span className="text-xs font-mono text-muted-foreground truncate">{pkg.slug}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {n} linked audit{n === 1 ? "" : "s"} · {templateList.length} in library
                    </span>
                    {!pkg.isActive ? <span className="text-[11px] text-amber-800">Inactive</span> : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-lg border bg-white p-4 shadow-sm space-y-4 min-w-0">
            {!activePackage ? (
              <p className="text-sm text-muted-foreground">Select a care package.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-[#005EB8] truncate">{activePackage.name}</h2>
                    <p className="text-xs font-mono text-muted-foreground truncate">{activePackage.slug}</p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                      Attach audits to this pathway. Changes to ticks are local until you press{" "}
                      <strong className="text-foreground">Save linked audits</strong>.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      type="button"
                      className="min-h-[44px] touch-manipulation bg-[#005EB8] hover:bg-[#004a94]"
                      disabled={saving === activePackage.id}
                      onClick={() => savePackageDetails(activePackage.id)}
                    >
                      {saving === activePackage.id ? "Saving…" : "Save package details"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] touch-manipulation"
                      disabled={saving === activePackage.id || templateList.length === 0}
                      onClick={() => saveLinkedAudits(activePackage.id)}
                    >
                      {saving === activePackage.id ? "Saving…" : "Save linked audits"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Display name</span>
                    <input
                      value={editByPackage[activePackage.id]?.name ?? activePackage.name}
                      onChange={(e) => setEditField(activePackage.id, { name: e.target.value })}
                      className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                      disabled={saving === activePackage.id}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Slug</span>
                    <input
                      value={editByPackage[activePackage.id]?.slug ?? activePackage.slug}
                      onChange={(e) => setEditField(activePackage.id, { slug: e.target.value })}
                      className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px] font-mono text-xs"
                      disabled={saving === activePackage.id}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">Sort order</span>
                    <input
                      value={editByPackage[activePackage.id]?.sortOrder ?? String(activePackage.sortOrder ?? 0)}
                      onChange={(e) => setEditField(activePackage.id, { sortOrder: e.target.value })}
                      inputMode="numeric"
                      className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                      disabled={saving === activePackage.id}
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] font-medium text-muted-foreground">Description</span>
                    <input
                      value={editByPackage[activePackage.id]?.description ?? (activePackage.description ?? "")}
                      onChange={(e) => setEditField(activePackage.id, { description: e.target.value })}
                      className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                      disabled={saving === activePackage.id}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm min-h-[44px] sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={editByPackage[activePackage.id]?.isActive ?? activePackage.isActive}
                      onChange={(e) => setEditField(activePackage.id, { isActive: e.target.checked })}
                      className="size-4 touch-manipulation"
                      disabled={saving === activePackage.id}
                    />
                    Active (shows on service user profiles)
                  </label>
                </div>
                {!(editByPackage[activePackage.id]?.isActive ?? activePackage.isActive) ? (
                  <p className="text-xs text-amber-800">This package is inactive — it will not appear when editing service users.</p>
                ) : null}

                <div className="border-t border-[#005EB8]/10 pt-4 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-[12rem]">
                      <label htmlFor="tpl-filter" className="text-[11px] font-medium text-muted-foreground">
                        Search audit templates
                      </label>
                      <input
                        id="tpl-filter"
                        value={templateQuery}
                        onChange={(e) => setTemplateQuery(e.target.value)}
                        placeholder="Type to filter by name, category, or scope…"
                        className="w-full rounded border border-[#005EB8]/15 px-3 py-2 min-h-[44px]"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredTemplates.length} of {templateList.length}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#005EB8] mb-2">Selected for this package ({selectedForActive.size})</p>
                    {selectedTemplateRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
                        Nothing selected yet — tick audits in the library below.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
                        {selectedTemplateRows.map((t) => (
                          <li
                            key={t.id}
                            className="text-xs rounded-full border border-[#005EB8]/25 bg-[#E8F4FC]/60 px-3 py-1.5 max-w-full truncate"
                            title={t.name}
                          >
                            {t.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#005EB8] mb-2">Audit template library</p>
                    {templateList.length === 0 ? null : filteredTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">No templates match your search.</p>
                    ) : (
                      <ul className="space-y-2 list-none m-0 p-0 max-h-[45vh] overflow-y-auto pr-1">
                        {filteredTemplates.map((t) => {
                          const on = selectionByPackage[activePackage.id]?.has(t.id) ?? false;
                          return (
                            <li
                              key={t.id}
                              className="flex flex-wrap items-center gap-3 rounded border border-[#005EB8]/10 px-3 py-2 min-h-[44px]"
                            >
                              <input
                                type="checkbox"
                                id={`${activePackage.id}-${t.id}`}
                                checked={on}
                                onChange={() => toggle(activePackage.id, t.id)}
                                className="size-4 touch-manipulation"
                              />
                              <label htmlFor={`${activePackage.id}-${t.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                                <span className="font-medium text-slate-900">{t.name}</span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  ·{" "}
                                  {t.assignmentScope === "PROPERTY"
                                    ? "Per property"
                                    : t.assignmentScope === "CARE_PACKAGE"
                                      ? "Care package scope"
                                      : t.assignmentScope}
                                  {t.category ? <> · {t.category}</> : null}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
