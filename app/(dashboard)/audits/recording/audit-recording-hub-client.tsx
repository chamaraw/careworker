"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, ClipboardList, Files } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type PropertyOpt = { id: string; name: string };
type TemplateOpt = { id: string; name: string; category: string | null };
type ServiceUserOpt = { id: string; name: string; dateOfBirth: string | null };
type ReportRow = {
  id: string;
  createdAt: string;
  templateName: string;
  propertyName: string;
  serviceUserName: string | null;
  status: string;
  submittedByName: string;
  submittedByEmail: string;
};

const NONE = "__none__";

function formatDob(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AuditRecordingHubClient({
  submitted,
  initialTab,
  selectedPropertyId,
  serviceUserId,
  isAdmin = false,
  templatesUsingDefaultFallback = false,
  properties,
  templates,
  serviceUsers,
  mySubmissions,
  lastReportForPatient,
}: {
  submitted: boolean;
  initialTab: "record" | "reports";
  selectedPropertyId: string;
  serviceUserId: string;
  isAdmin?: boolean;
  /** True when no forms were assigned to the venue — all active templates are shown */
  templatesUsingDefaultFallback?: boolean;
  properties: PropertyOpt[];
  templates: TemplateOpt[];
  serviceUsers: ServiceUserOpt[];
  mySubmissions: ReportRow[];
  lastReportForPatient: {
    createdAt: string;
    templateName: string;
    submittedByName: string | null;
    submittedByEmail: string | null;
  } | null;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"record" | "reports">(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  /** Labels for Select.Value render (avoid `items` on Root + SelectItem duplication / layout glitches). */
  const propertyItems = useMemo(
    () =>
      ({
        [NONE]: "Choose property…",
        ...Object.fromEntries(properties.map((p) => [p.id, p.name] as [string, string])),
      }) as Record<string, string>,
    [properties]
  );
  const serviceUserItems = useMemo(
    () =>
      ({
        [NONE]: "None — generic recording",
        ...Object.fromEntries(
          serviceUsers.map((su) => {
            const dob = su.dateOfBirth ? formatDob(su.dateOfBirth) : "";
            const label = dob ? `${su.name} · DOB ${dob}` : su.name;
            return [su.id, label] as [string, string];
          })
        ),
      }) as Record<string, string>,
    [serviceUsers]
  );

  function pushRecordingQuery(next: { propertyId?: string; serviceUserId?: string; tab?: string }) {
    const p = new URLSearchParams();
    const pid = next.propertyId ?? selectedPropertyId;
    if (pid) p.set("propertyId", pid);
    const sid = next.serviceUserId !== undefined ? next.serviceUserId : serviceUserId;
    if (sid) p.set("serviceUserId", sid);
    p.set("tab", next.tab ?? activeTab);
    router.push(`/audits/recording?${p.toString()}`);
    router.refresh();
  }

  function buildRecordingUrl(templateId: string) {
    const p = new URLSearchParams();
    p.set("propertyId", selectedPropertyId);
    if (serviceUserId) p.set("serviceUserId", serviceUserId);
    return `/audits/submit/${templateId}?${p.toString()}`;
  }

  function goToTab(next: "record" | "reports") {
    setActiveTab(next);
    pushRecordingQuery({ tab: next });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold text-[#005EB8]">Form recording</h1>
          {submitted ? (
            <p className="text-sm text-green-600">Report submitted and added to All reports.</p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-2 self-end rounded-lg border border-[#005EB8]/25 bg-white px-3 py-2 text-sm font-medium text-[#005EB8] shadow-sm outline-none transition-colors",
              "hover:bg-[#E8F4FC] focus-visible:ring-2 focus-visible:ring-[#005EB8]/40 min-h-[44px] touch-manipulation sm:self-start"
            )}
            aria-label="Choose audit recording view"
          >
            <span className="tabular-nums">{activeTab === "record" ? "Record" : "All reports"}</span>
            <ChevronDown className="size-4 shrink-0 opacity-80" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-[12.5rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">This page</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-[44px] gap-2 cursor-pointer"
              onSelect={() => goToTab("record")}
            >
              <ClipboardList className="size-4 shrink-0 opacity-80" aria-hidden />
              <span className="flex-1">Record</span>
              {activeTab === "record" ? <Check className="size-4 shrink-0 text-[#007F3B]" aria-hidden /> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-[44px] gap-2 cursor-pointer"
              onSelect={() => goToTab("reports")}
            >
              <Files className="size-4 shrink-0 opacity-80" aria-hidden />
              <span className="flex-1">All reports</span>
              {activeTab === "reports" ? <Check className="size-4 shrink-0 text-[#007F3B]" aria-hidden /> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded border p-3 text-sm space-y-2">
        <p className="font-medium">Property</p>
        {properties.length === 0 ? (
          <div className="space-y-2 text-muted-foreground">
            <p>No care venues are available yet.</p>
            {isAdmin ? (
              <p>
                Add a venue under{" "}
                <Link href="/housing" className="text-[#005EB8] underline font-medium">
                  Housing
                </Link>{" "}
                (or your existing roster property list), then assign care forms under{" "}
                <Link href="/audits" className="text-[#005EB8] underline font-medium">
                  Audits
                </Link>{" "}
                → property.
              </p>
            ) : (
              <p>Ask an admin to add care venues and assign audit templates to your location.</p>
            )}
          </div>
        ) : (
          <Select
            value={selectedPropertyId && properties.some((p) => p.id === selectedPropertyId) ? selectedPropertyId : NONE}
            onValueChange={(v) => {
              const id = v === NONE ? "" : (v ?? "");
              pushRecordingQuery({ propertyId: id, serviceUserId: "", tab: "record" });
            }}
          >
            <SelectTrigger className="w-full max-w-md min-h-[44px] touch-manipulation">
              <SelectValue placeholder="Choose property">
                {(val: unknown) => {
                  const s = typeof val === "string" ? val : "";
                  if (!s || s === NONE) return null;
                  return propertyItems[s] ?? s;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Choose property…</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeTab === "record" ? (
        <div className="space-y-4 pt-0">
          {!selectedPropertyId ? (
            <p className="text-sm text-muted-foreground">Select a property to see assigned templates.</p>
          ) : templates.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>No active care forms exist yet.</p>
              {isAdmin ? (
                <p>
                  Create templates under{" "}
                  <Link href="/audits/templates" className="text-[#005EB8] underline font-medium">
                    Audits → Templates
                  </Link>
                  , then assign them per venue under{" "}
                  <Link href="/audits" className="text-[#005EB8] underline font-medium">
                    Audits
                  </Link>{" "}
                  → property (or they will appear here automatically once templates exist).
                </p>
              ) : (
                <p>Ask an admin to add forms in Audits.</p>
              )}
            </div>
          ) : (
            <div className="rounded border p-3 space-y-3">
              {templatesUsingDefaultFallback ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                  <strong className="font-medium">No forms apply to this venue yet</strong> — add{" "}
                  <strong className="font-medium">organisation-wide</strong> templates, enable{" "}
                  <strong className="font-medium">property-scoped</strong> forms for the property, and/or assign{" "}
                  <strong className="font-medium">person-only</strong> forms after selecting a patient.{" "}
                  {isAdmin ? (
                    <>
                      Configure scopes under{" "}
                      <Link href="/audits/templates" className="underline font-medium">
                        Audits → Templates
                      </Link>{" "}
                      and assignments under{" "}
                      <Link href="/audits" className="underline font-medium">
                        Audits → property
                      </Link>
                      .
                    </>
                  ) : (
                    "Ask an admin to set up templates and assignments."
                  )}
                </div>
              ) : null}
              <p className="font-medium text-sm">Patient / service user (optional — auto-fills name &amp; DOB)</p>
              <Select
                key={selectedPropertyId || "no-property"}
                value={serviceUserId ? serviceUserId : NONE}
                onValueChange={(v) => {
                  const uid = v === NONE ? "" : (v ?? "");
                  pushRecordingQuery({ serviceUserId: uid });
                }}
              >
                <SelectTrigger className="w-full max-w-md min-h-[44px] touch-manipulation">
                  <SelectValue placeholder="Select patient for this recording">
                    {(val: unknown) => {
                      const s = typeof val === "string" ? val : "";
                      if (!s || s === NONE) return null;
                      return serviceUserItems[s] ?? s;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None — generic recording</SelectItem>
                  {serviceUsers.map((su) => (
                    <SelectItem key={su.id} value={su.id}>
                      {su.name}
                      {su.dateOfBirth ? ` · DOB ${formatDob(su.dateOfBirth)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serviceUserId && lastReportForPatient ? (
                <p className="text-xs text-muted-foreground rounded-md border border-[#005EB8]/20 bg-[#E8F4FC]/50 px-3 py-2">
                  <span className="font-medium text-[#005EB8]">Last report for this patient: </span>
                  {lastReportForPatient.templateName}
                  {" — "}
                  <span className="text-slate-700">{formatDt(lastReportForPatient.createdAt)}</span>
                  {" — "}
                  <span className="text-slate-700">
                    by{" "}
                    {lastReportForPatient.submittedByName?.trim() ||
                      lastReportForPatient.submittedByEmail ||
                      "staff"}
                  </span>
                </p>
              ) : serviceUserId ? (
                <p className="text-xs text-muted-foreground">No previous saved report for this patient at this venue.</p>
              ) : null}

              <p className="font-medium text-sm pt-2">
                {templatesUsingDefaultFallback ? "Templates (none matched)" : "Templates for this venue / patient"}
              </p>
              <div className="space-y-2">
                {templates.map((t) => {
                  const isBpDiary = t.name.toLowerCase().includes("blood pressure");
                  const needPatient = isBpDiary && !serviceUserId;
                  return (
                  <div
                    key={t.id}
                    className="flex flex-col gap-2 rounded border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-muted-foreground">{t.category ?? "General"}</div>
                      {needPatient ? (
                        <p className="text-xs text-amber-700 mt-1">
                          Select a patient above — name and DOB will auto-fill for this diary.
                        </p>
                      ) : null}
                    </div>
                    {needPatient ? (
                      <span className="inline-flex min-h-9 items-center text-muted-foreground text-sm">
                        Choose patient first
                      </span>
                    ) : (
                    <Link
                      href={buildRecordingUrl(t.id)}
                      className="inline-flex min-h-9 items-center justify-center self-start rounded-md border border-[#005EB8]/30 bg-[#005EB8]/5 px-3 py-1.5 text-sm font-medium text-[#005EB8] underline-offset-2 hover:underline touch-manipulation sm:self-center"
                    >
                      Start recording
                    </Link>
                    )}
                  </div>
                );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose a patient first when the form asks for service user name and date of birth — those fields
                fill in automatically. Submitted reports appear under <strong>All reports</strong>.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Your submitted reports{selectedPropertyId ? " for this property" : " (all properties)"}.
            </p>
            {mySubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              mySubmissions.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{r.templateName}</div>
                    <div className="text-muted-foreground">
                      {r.propertyName}
                      {r.serviceUserName ? ` · ${r.serviceUserName}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDt(r.createdAt)} · {r.status}
                      {" · "}
                      <span className="text-slate-600">
                        by {r.submittedByName?.trim() || r.submittedByEmail}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/audits/submissions/${r.id}`}
                    className="inline-flex min-h-9 items-center self-start text-sm font-medium text-[#005EB8] underline underline-offset-2 touch-manipulation sm:self-center"
                  >
                    View report
                  </Link>
                </div>
              ))
            )}
          </div>
      )}
    </div>
  );
}
