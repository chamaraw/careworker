"use client";

import { useMemo, useState } from "react";
import { useRegisterStaffAssistantPage } from "@/components/staff-assistant/staff-assistant-context";
import { StaffAssistantFieldDraftButton } from "@/components/staff-assistant/StaffAssistantFieldDraftButton";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createShift, updateShift } from "@/app/(dashboard)/roster/actions";
import { format } from "date-fns";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function ShiftForm({
  defaultStart,
  defaultEnd,
  careWorkers,
  serviceUsers,
  properties,
  onClose,
  onSuccess,
  shiftId,
  initialCareWorkerId,
  initialServiceUserId,
  initialPropertyId,
  initialNotes,
}: {
  defaultStart: Date;
  defaultEnd: Date;
  careWorkers: { id: string; name: string }[];
  serviceUsers: { id: string; name: string; propertyId?: string | null }[];
  properties: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  shiftId?: string;
  initialCareWorkerId?: string;
  initialServiceUserId?: string;
  initialPropertyId?: string | null;
  initialNotes?: string | null;
}) {
  const [careWorkerId, setCareWorkerId] = useState(initialCareWorkerId ?? "");
  const [serviceUserId, setServiceUserId] = useState(initialServiceUserId ?? "");
  const [propertyId, setPropertyId] = useState(initialPropertyId ?? "");
  const startDate = defaultStart instanceof Date ? defaultStart : new Date(defaultStart);
  const endDate = defaultEnd instanceof Date ? defaultEnd : new Date(defaultEnd);
  const [startAt, setStartAt] = useState(format(startDate, "yyyy-MM-dd'T'HH:mm"));
  const [endAt, setEndAt] = useState(format(endDate, "yyyy-MM-dd'T'HH:mm"));
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState("");

  const assistantReg = useMemo(
    () => ({
      flowId: "roster",
      fields: [
        {
          id: "notes",
          label: "Shift notes",
          insertable: true,
          whatGoodLooksLike: "Factual, contemporaneous notes — who was present, tasks, risks, handover points.",
        },
        {
          id: "startAt",
          label: "Start",
          required: true,
          whatGoodLooksLike: "Local date/time matching the real visit start.",
        },
        {
          id: "endAt",
          label: "End",
          required: true,
          whatGoodLooksLike: "Must be after start; adjust if the visit overran.",
        },
      ],
      getShareablePreview: () =>
        JSON.stringify(
          {
            careWorkerId: careWorkerId || null,
            serviceUserId: serviceUserId || null,
            propertyId: propertyId || null,
            startAt,
            endAt,
            notes: notes.slice(0, 4000),
          },
          null,
          2
        ),
    }),
    [careWorkerId, serviceUserId, propertyId, startAt, endAt, notes]
  );
  useRegisterStaffAssistantPage("shift-form-dialog", assistantReg);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (shiftId) {
        await updateShift(shiftId, {
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          careWorkerId: careWorkerId || undefined,
          serviceUserId: serviceUserId || undefined,
          propertyId: propertyId || null,
          notes: notes || undefined,
        });
      } else {
        if (!careWorkerId || !serviceUserId) {
          setError("Please select care worker and service user.");
          return;
        }
        await createShift({
          careWorkerId,
          serviceUserId,
          propertyId: propertyId || undefined,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          notes: notes || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{shiftId ? "Edit shift" : "New shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Care worker</Label>
            <Select
              value={careWorkerId}
              onValueChange={(v) => v && setCareWorkerId(v)}
              required={!shiftId}
            >
              <SelectTrigger className="min-h-[48px]">
                {careWorkerId ? (
                  <span className="truncate">{careWorkers.find((w) => w.id === careWorkerId)?.name ?? careWorkerId}</span>
                ) : (
                  <SelectValue placeholder="Select…" />
                )}
              </SelectTrigger>
              <SelectContent>
                {careWorkers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Service user</Label>
            <Select
              value={serviceUserId}
              onValueChange={(v) => {
                if (v) {
                  setServiceUserId(v);
                  const su = serviceUsers.find((u) => u.id === v);
                  if (su?.propertyId) setPropertyId(su.propertyId);
                }
              }}
              required={!shiftId}
            >
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
          {properties.length > 0 && (
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={(v) => setPropertyId(v ?? "")}>
                <SelectTrigger className="min-h-[48px]">
                  {propertyId ? (
                    <span className="truncate">{properties.find((p) => p.id === propertyId)?.name ?? propertyId}</span>
                  ) : (
                    <SelectValue placeholder="Optional – from service user" />
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Optional</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
                className="min-h-[48px]"
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
                className="min-h-[48px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Notes</Label>
              <StaffAssistantFieldDraftButton fieldId="shift_notes" label="Shift notes" onApply={setNotes} />
            </div>
            <p className="text-xs text-muted-foreground">
              Large box for typing or Apple Pencil / handwriting on iPad.
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoComplete="off"
              className="min-h-[180px] text-lg leading-relaxed touch-pan-y touch-manipulation resize-y p-4 input-text-base border-2 border-sky-200/70 focus-visible:border-[#005EB8] dark:border-sky-800/50"
            />
          </div>
          <div className="flex gap-2">
            <SubmitButton label={shiftId ? "Update" : "Create"} />
            <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
