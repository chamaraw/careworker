"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setPropertyTemplateOptOutForServiceUser, setServiceUserPersonalTemplateActive } from "../../actions";

type ServiceUserRow = { id: string; name: string; dateOfBirth: string | null };

type PanelState = {
  personalFormIds: string[];
  excludedPropertyTemplateIds: string[];
  excludedCarePackageTemplateIds: string[];
};

export function ServiceUserAssignmentsClient({
  serviceUsers,
  personOnlyTemplates,
  propertyTemplatesAtVenue,
  initialPanelByServiceUserId,
  carePackageSectionByServiceUserId,
}: {
  serviceUsers: ServiceUserRow[];
  personOnlyTemplates: { id: string; name: string }[];
  /** PROPERTY-scoped forms currently enabled for this venue (opt-out applies per person). */
  propertyTemplatesAtVenue: { id: string; name: string }[];
  initialPanelByServiceUserId: Record<string, PanelState>;
  carePackageSectionByServiceUserId: Record<
    string,
    { packageName: string | null; forms: { id: string; name: string }[] }
  >;
}) {
  const router = useRouter();
  const [activeServiceUserId, setActiveServiceUserId] = useState(serviceUsers[0]?.id ?? "");
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const panel = useMemo(() => {
    return (
      initialPanelByServiceUserId[activeServiceUserId] ?? {
        personalFormIds: [],
        excludedPropertyTemplateIds: [],
        excludedCarePackageTemplateIds: [],
      }
    );
  }, [activeServiceUserId, initialPanelByServiceUserId]);

  const personalSet = useMemo(() => new Set(panel.personalFormIds), [panel.personalFormIds]);
  const excludedSet = useMemo(() => new Set(panel.excludedPropertyTemplateIds), [panel.excludedPropertyTemplateIds]);
  const excludedCarePkgSet = useMemo(
    () => new Set(panel.excludedCarePackageTemplateIds),
    [panel.excludedCarePackageTemplateIds]
  );

  const careSection = carePackageSectionByServiceUserId[activeServiceUserId] ?? {
    packageName: null,
    forms: [],
  };

  if (serviceUsers.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-[#005EB8] text-lg">Service user forms</h2>
        <p className="text-sm text-muted-foreground mt-1">
          No service users are linked to this property yet. Add them under <strong className="text-foreground">Service Users</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm space-y-4">
      <div className="min-w-0">
        <h2 className="font-semibold text-[#005EB8] text-lg">Service user forms</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">
          <strong className="text-foreground">Care package</strong> forms come from the pathway set on each person’s profile.{" "}
          <strong className="text-foreground">Person-only</strong> forms apply only when assigned below.{" "}
          <strong className="text-foreground">Property forms</strong> can be turned off for individuals. You can exclude specific care-package forms per person without changing their package.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="lg:w-[18rem] shrink-0 space-y-2">
          <p className="text-sm font-medium">Service users</p>
          <div className="max-h-[50vh] overflow-auto rounded border border-[#005EB8]/15">
            {serviceUsers.map((su) => (
              <button
                key={su.id}
                type="button"
                onClick={() => setActiveServiceUserId(su.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm min-h-[44px] touch-manipulation border-b last:border-b-0",
                  activeServiceUserId === su.id
                    ? "bg-[#E8F4FC] text-[#005EB8] font-semibold"
                    : "bg-white hover:bg-muted/40"
                )}
              >
                <div className="truncate">{su.name}</div>
                {su.dateOfBirth ? (
                  <div className="text-xs text-muted-foreground">
                    DOB {new Date(su.dateOfBirth).toLocaleDateString("en-GB")}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <section className="space-y-2">
            <p className="text-sm font-semibold text-[#005EB8]">Care package forms</p>
            {!careSection.packageName ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3 leading-relaxed">
                No care package on this profile — set one under{" "}
                <Link href={`/service-users/${activeServiceUserId}/edit`} className="underline text-[#005EB8] font-medium">
                  Service users → Edit
                </Link>
                . Link templates to packages under{" "}
                <Link href="/audits/care-packages" className="underline text-[#005EB8] font-medium">
                  Audits → Care packages
                </Link>
                .
              </p>
            ) : careSection.forms.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3 leading-relaxed">
                Package <strong className="text-slate-800">{careSection.packageName}</strong> has no audit forms linked yet. Use{" "}
                <Link href="/audits/care-packages" className="underline text-[#005EB8] font-medium">
                  Care packages
                </Link>{" "}
                (templates must use assignment <strong className="text-slate-800">Care package</strong>).
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  From package: <strong className="text-slate-800">{careSection.packageName}</strong>
                </p>
                <ul className="space-y-2 list-none p-0 m-0">
                  {careSection.forms.map((t) => {
                    const excluded = excludedCarePkgSet.has(t.id);
                    const included = !excluded;
                    const key = `cp:${activeServiceUserId}:${t.id}`;
                    return (
                      <li
                        key={t.id}
                        className="rounded border border-[#005EB8]/15 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm min-w-0">
                          <div className="font-medium text-slate-900">{t.name}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {included ? "Included for this person" : "Excluded for this person"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={included ? "default" : "outline"}
                          className={cn(
                            "min-h-[44px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                            included && "bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground"
                          )}
                          disabled={!activeServiceUserId || saving[key]}
                          onClick={async () => {
                            setSaving((s) => ({ ...s, [key]: true }));
                            try {
                              await setPropertyTemplateOptOutForServiceUser(activeServiceUserId, t.id, included);
                              router.refresh();
                            } finally {
                              setSaving((s) => ({ ...s, [key]: false }));
                            }
                          }}
                        >
                          {saving[key] ? "Saving…" : included ? "Exclude for person" : "Include for person"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[#005EB8]">Person-only forms</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create these under Audits → Templates with assignment set to <strong className="text-slate-800">Per service user only</strong>.
            </p>
            {personOnlyTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
                No person-only templates in the library yet.
              </p>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {personOnlyTemplates.map((t) => {
                  const enabled = personalSet.has(t.id);
                  const key = `p:${activeServiceUserId}:${t.id}`;
                  return (
                    <li
                      key={t.id}
                      className="rounded border border-[#005EB8]/15 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm min-w-0">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {enabled ? "Assigned to this person" : "Not assigned"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={enabled ? "default" : "outline"}
                        className={cn(
                          "min-h-[44px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                          enabled && "bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground"
                        )}
                        disabled={!activeServiceUserId || saving[key]}
                        onClick={async () => {
                          setSaving((s) => ({ ...s, [key]: true }));
                          try {
                            await setServiceUserPersonalTemplateActive(activeServiceUserId, t.id, !enabled);
                            router.refresh();
                          } finally {
                            setSaving((s) => ({ ...s, [key]: false }));
                          }
                        }}
                      >
                        {saving[key] ? "Saving…" : enabled ? "Remove for person" : "Assign to person"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold text-[#005EB8]">Property forms for this venue</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              These are enabled for <strong className="text-slate-800">this property</strong>. Use{" "}
              <strong className="text-foreground">Exclude form from the property</strong> when this person should not see a form here (e.g. not on that care pathway).
            </p>
            {propertyTemplatesAtVenue.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-md p-3">
                No property-scoped forms are enabled for this venue yet. Use the list above to add them.
              </p>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {propertyTemplatesAtVenue.map((t) => {
                  const excluded = excludedSet.has(t.id);
                  const included = !excluded;
                  const key = `e:${activeServiceUserId}:${t.id}`;
                  return (
                    <li
                      key={t.id}
                      className="rounded border border-[#005EB8]/15 p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm min-w-0">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        <div className="text-muted-foreground mt-0.5">
                          {included ? "Included for this person" : "Excluded for this person"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={included ? "default" : "outline"}
                        className={cn(
                          "min-h-[44px] touch-manipulation shrink-0 sm:min-w-[10rem]",
                          included && "bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground"
                        )}
                        disabled={!activeServiceUserId || saving[key]}
                        onClick={async () => {
                          setSaving((s) => ({ ...s, [key]: true }));
                          try {
                            await setPropertyTemplateOptOutForServiceUser(activeServiceUserId, t.id, included);
                            router.refresh();
                          } finally {
                            setSaving((s) => ({ ...s, [key]: false }));
                          }
                        }}
                      >
                        {saving[key] ? "Saving…" : included ? "Exclude form from the property" : "Include form at the property"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
