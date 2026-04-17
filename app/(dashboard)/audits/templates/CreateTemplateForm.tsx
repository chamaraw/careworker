"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createFormTemplate } from "../actions";
import type { AuditTemplateAssignmentScope } from "@prisma/client";

export function CreateTemplateForm({ initialScope }: { initialScope?: AuditTemplateAssignmentScope }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<AuditTemplateAssignmentScope>(initialScope ?? "PROPERTY");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const created = await createFormTemplate({
        name,
        category,
        assignmentScope,
        fields: [{ key: "notes", label: "Notes", type: "TEXTAREA", required: true }],
      });
      router.push(`/audits/templates/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded border p-4 space-y-3 max-w-xl">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div className="space-y-1"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
      <div className="space-y-1">
        <Label>Assignment</Label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
          value={assignmentScope}
          onChange={(e) => setAssignmentScope(e.target.value as AuditTemplateAssignmentScope)}
        >
          <option value="GLOBAL">Organisation-wide</option>
          <option value="PROPERTY">Per property</option>
          <option value="SERVICE_USER">Per service user only</option>
          <option value="CARE_PACKAGE">Care package (link under Audits → Care packages)</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create template"}</Button>
    </form>
  );
}
