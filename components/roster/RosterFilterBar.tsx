"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Building2, ChevronDown, Palette, UserCircle2, Users } from "lucide-react";

function parseIdList(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((id) => id.length > 0 && id.length < 48);
}

export function RosterFilterBar({
  properties,
  careWorkers,
  serviceUsers,
  isAdmin,
}: {
  properties: { id: string; name: string }[];
  careWorkers: { id: string; name: string }[];
  serviceUsers: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const propertyIds = useMemo(() => {
    const fromMulti = parseIdList(searchParams.get("properties"));
    if (fromMulti.length > 0) return new Set(fromMulti);
    const legacy = searchParams.get("property")?.trim();
    if (legacy && legacy !== "all") return new Set([legacy]);
    return new Set<string>();
  }, [searchParams]);

  const staffIds = useMemo(() => new Set(parseIdList(searchParams.get("staff"))), [searchParams]);
  const serviceUserIds = useMemo(
    () => new Set(parseIdList(searchParams.get("serviceUsers"))),
    [searchParams]
  );
  const colorBy: "property" | "staff" | "status" = useMemo(() => {
    const raw = searchParams.get("colorBy");
    if (raw === "property") return "property";
    if (raw === "staff" && isAdmin) return "staff";
    return "status";
  }, [searchParams, isAdmin]);

  const setParam = useCallback(
    (key: string, values: Set<string>) => {
      const next = new URLSearchParams(searchParams.toString());
      if (values.size === 0) next.delete(key);
      else next.set(key, Array.from(values).join(","));
      if (key === "properties") next.delete("property");
      router.replace(`/roster?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const toggle = useCallback(
    (key: "properties" | "staff" | "serviceUsers", id: string) => {
      const cur =
        key === "properties"
          ? new Set(propertyIds)
          : key === "staff"
            ? new Set(staffIds)
            : new Set(serviceUserIds);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      setParam(key, cur);
    },
    [propertyIds, staffIds, serviceUserIds, setParam]
  );

  const clearAll = useCallback(() => {
    const next = new URLSearchParams();
    const cb = searchParams.get("colorBy");
    if (cb && (cb === "property" || cb === "staff" || cb === "status")) next.set("colorBy", cb);
    const q = next.toString();
    router.replace(q ? `/roster?${q}` : "/roster", { scroll: false });
  }, [router, searchParams]);

  const setColorBy = useCallback(
    (v: "property" | "staff" | "status") => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("colorBy", v);
      router.replace(`/roster?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const activeCount = propertyIds.size + staffIds.size + serviceUserIds.size;

  return (
    <div className="rounded-2xl border border-[#005EB8]/20 bg-gradient-to-b from-[#E8F4FC]/90 to-white shadow-sm overflow-hidden">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-[#005EB8] to-[#004a94] text-white [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm sm:text-base truncate">Roster filters</span>
            {activeCount > 0 ? (
              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                {activeCount} active
              </span>
            ) : (
              <span className="text-xs text-white/85 hidden sm:inline">All shifts in range</span>
            )}
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 opacity-90" />
        </summary>

        <div className="p-4 space-y-4 border-t border-[#005EB8]/10">
          <div className="grid gap-4 lg:grid-cols-3">
            <FilterColumn
              icon={<Building2 className="h-4 w-4 text-[#005EB8]" aria-hidden />}
              title="Properties"
              description="Match venue or service user’s home property."
              empty={properties.length === 0 ? "No properties" : undefined}
            >
              {properties.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#E8EDEE]/80 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#005EB8]/40 text-[#005EB8] focus:ring-[#005EB8]"
                    checked={propertyIds.has(p.id)}
                    onChange={() => toggle("properties", p.id)}
                  />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </FilterColumn>

            {isAdmin ? (
              <FilterColumn
                icon={<UserCircle2 className="h-4 w-4 text-[#005EB8]" aria-hidden />}
                title="Staff"
                description="One or more care workers."
                empty={careWorkers.length === 0 ? "No staff" : undefined}
              >
                {careWorkers.map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#E8EDEE]/80 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#005EB8]/40 text-[#005EB8] focus:ring-[#005EB8]"
                      checked={staffIds.has(w.id)}
                      onChange={() => toggle("staff", w.id)}
                    />
                    <span className="truncate">{w.name}</span>
                  </label>
                ))}
              </FilterColumn>
            ) : (
              <div className="rounded-xl border border-dashed border-[#005EB8]/25 bg-[#E8F4FC]/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-[#005EB8]">Staff filter</p>
                <p className="mt-1">Only admins can filter by multiple staff. Your roster shows your own shifts.</p>
              </div>
            )}

            <FilterColumn
              icon={<Users className="h-4 w-4 text-[#005EB8]" aria-hidden />}
              title="Service users"
              description="Focus visits for selected people."
              empty={serviceUsers.length === 0 ? "No service users" : undefined}
            >
              {serviceUsers.map((su) => (
                <label
                  key={su.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#E8EDEE]/80 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#005EB8]/40 text-[#005EB8] focus:ring-[#005EB8]"
                    checked={serviceUserIds.has(su.id)}
                    onChange={() => toggle("serviceUsers", su.id)}
                  />
                  <span className="truncate">{su.name}</span>
                </label>
              ))}
            </FilterColumn>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-t border-[#005EB8]/10 pt-4">
            <div className="space-y-1.5 min-w-[12rem]">
              <Label className="text-xs font-semibold text-[#005EB8] flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" aria-hidden />
                Colour shifts by
              </Label>
              <select
                id="roster-color-by"
                className="w-full sm:w-56 rounded-lg border border-[#005EB8]/25 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#005EB8]/30 min-h-[44px]"
                value={colorBy}
                onChange={(e) => setColorBy(e.target.value as "property" | "staff" | "status")}
              >
                <option value="status">Status (scheduled / in progress / …)</option>
                <option value="property">Property (stable colours)</option>
                {isAdmin ? <option value="staff">Staff member</option> : null}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] border-[#005EB8]/30 text-[#005EB8] hover:bg-[#E8F4FC]"
              onClick={clearAll}
              disabled={activeCount === 0}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </details>
    </div>
  );
}

function FilterColumn({
  icon,
  title,
  description,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#005EB8]/15 bg-white/80 p-3 shadow-sm">
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5">{icon}</span>
        <div>
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        </div>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground py-2">{empty}</p>
      ) : (
        <div className={cn("max-h-52 overflow-y-auto touch-pan-y space-y-0.5 pr-1")}>{children}</div>
      )}
    </div>
  );
}
