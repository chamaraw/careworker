"use client";

import { useMemo, useState } from "react";
import { useRegisterStaffAssistantPage } from "@/components/staff-assistant/staff-assistant-context";
import { StaffAssistantFieldDraftButton } from "@/components/staff-assistant/StaffAssistantFieldDraftButton";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createIncident } from "@/app/(dashboard)/incidents/actions";

const SEVERITIES = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
      {pending ? "Submitting…" : "Submit report"}
    </Button>
  );
}

export function IncidentForm({
  serviceUsers,
  onClose,
  onSuccess,
}: {
  serviceUsers: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [serviceUserId, setServiceUserId] = useState("");
  const [severity, setSeverity] = useState<string>("MEDIUM");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [error, setError] = useState("");

  const assistantReg = useMemo(
    () => ({
      flowId: "incidents",
      fields: [
        {
          id: "description",
          label: "What happened",
          required: true,
          insertable: true,
          whatGoodLooksLike: "Chronological facts: time, place, people involved, immediate risks.",
        },
        {
          id: "actionTaken",
          label: "Action taken",
          insertable: true,
          whatGoodLooksLike: "What was done to keep people safe, who was informed, and when.",
        },
      ],
      getShareablePreview: () =>
        JSON.stringify(
          {
            serviceUserId: serviceUserId || null,
            severity,
            description: description.slice(0, 4000),
            actionTaken: actionTaken.slice(0, 2000),
            followUpNotes: followUpNotes.slice(0, 2000),
          },
          null,
          2
        ),
    }),
    [serviceUserId, severity, description, actionTaken, followUpNotes]
  );
  useRegisterStaffAssistantPage("incident-form-dialog", assistantReg);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!serviceUserId || !description.trim()) {
      setError("Select service user and describe what happened.");
      return;
    }
    try {
      await createIncident({
        serviceUserId,
        severity: severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        description: description.trim(),
        actionTaken: actionTaken.trim() || undefined,
        followUpNotes: followUpNotes.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report incident</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label>Service user</Label>
            <Select value={serviceUserId} onValueChange={(v) => v && setServiceUserId(v)} required>
              <SelectTrigger className="min-h-[48px]">
                {serviceUserId ? (
                  <span className="truncate">{serviceUsers.find((u) => u.id === serviceUserId)?.name ?? serviceUserId}</span>
                ) : (
                  <SelectValue placeholder="Select…" />
                )}
              </SelectTrigger>
              <SelectContent>
                {serviceUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => v && setSeverity(v)}>
              <SelectTrigger className="min-h-[48px]">
                {severity ? (
                  <span className="truncate">{SEVERITIES.find((s) => s.value === severity)?.label ?? severity}</span>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>What happened?</Label>
              <StaffAssistantFieldDraftButton
                fieldId="incident_description"
                label="Incident description"
                onApply={setDescription}
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the incident…"
              className="min-h-[100px] text-base"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Action taken (optional)</Label>
              <StaffAssistantFieldDraftButton fieldId="action_taken" label="Action taken" onApply={setActionTaken} />
            </div>
            <Textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="What did you do in response?"
              className="min-h-[80px] text-base"
            />
          </div>
          <div className="space-y-2">
            <Label>Follow-up notes (optional)</Label>
            <Textarea
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              placeholder="Any follow-up needed?"
              className="min-h-[80px] text-base"
            />
          </div>
          <div className="flex gap-2">
            <SubmitButton />
            <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
