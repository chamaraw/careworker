import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getFormTemplates } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTemplateForm } from "./CreateTemplateForm";
import { DuplicateTemplateButton } from "./DuplicateTemplateButton";
import { LoadDefaultTemplatesButton } from "./LoadDefaultTemplatesButton";

export default async function AuditTemplatesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const sp = searchParams ?? {};
  const initialScopeRaw = Array.isArray(sp.scope) ? sp.scope[0] : sp.scope;
  const initialScope =
    initialScopeRaw === "GLOBAL" ||
    initialScopeRaw === "PROPERTY" ||
    initialScopeRaw === "SERVICE_USER" ||
    initialScopeRaw === "CARE_PACKAGE"
      ? initialScopeRaw
      : undefined;
  const templates = await getFormTemplates();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit templates</h1>
      <CreateTemplateForm initialScope={initialScope} />
      <LoadDefaultTemplatesButton />
      <Card>
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.category ?? "General"} ·{" "}
                    {t.assignmentScope === "GLOBAL"
                      ? "Org-wide"
                      : t.assignmentScope === "SERVICE_USER"
                        ? "Person-only"
                        : t.assignmentScope === "CARE_PACKAGE"
                          ? "Care package"
                          : "Per property"}{" "}
                    · v{t.version} · {t.isActive ? "Active" : "Inactive"}
                    {t.templateCode ? (
                      <>
                        {" "}
                        · code: <span className="font-mono text-xs">{t.templateCode}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DuplicateTemplateButton templateId={t.id} />
                  <Link href={`/audits/templates/${t.id}`} className="underline text-sm min-h-[40px] inline-flex items-center">
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
