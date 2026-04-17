import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getAuditTemplateChangeLogs, getFormTemplate } from "../../actions";
import { EditTemplateClient } from "./EditTemplateClient";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const [template, changeLogs] = await Promise.all([getFormTemplate(id), getAuditTemplateChangeLogs(id, 40)]);
  if (!template) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit template: {template.name}</h1>
      <EditTemplateClient
        id={template.id}
        fields={Array.isArray(template.fields) ? (template.fields as never[]) : []}
        name={template.name}
        category={template.category ?? ""}
        templateCode={template.templateCode ?? ""}
        aiAssistantPrompt={template.aiAssistantPrompt ?? ""}
        assignmentScope={template.assignmentScope}
        filingFrequency={template.filingFrequency}
        monthlyFilingDueDay={template.monthlyFilingDueDay ?? null}
        templateVersion={template.version}
      />
      <div className="rounded-lg border border-[#005EB8]/20 bg-[#F8FAFC] p-4 max-w-3xl space-y-3">
        <h2 className="text-base font-semibold text-[#005EB8]">Change history</h2>
        <p className="text-xs text-muted-foreground">
          Each save that alters the form records who made the change, the new template version, and a summary of what
          changed. Submitted reports stay on the version filed; new filings use the current definition.
        </p>
        {changeLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes logged yet (edits after this release appear here).</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {changeLogs.map((log) => (
              <li key={log.id} className="rounded-md border border-[#E8EDEE] bg-white px-3 py-2">
                <p className="font-medium text-foreground">
                  {new Date(log.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·
                  version {log.versionAfter} · {log.changedBy?.name ?? "Unknown user"}
                </p>
                <p className="text-muted-foreground mt-0.5">{log.summaryLine}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
