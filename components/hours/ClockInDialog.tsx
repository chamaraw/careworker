"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { clockIn } from "@/app/(dashboard)/hours/actions";
import type { ClockInEligibilityPayload } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import type { ShiftType } from "@prisma/client";
import { LiveDateTimeDisplay } from "./LiveDateTimeDisplay";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const SHIFT_TYPE_OPTIONS: { value: ShiftType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "LONE_WORKING", label: "Lone working" },
  { value: "AWAKE_NIGHT", label: "Awake night (hourly)" },
  { value: "SLEEP_NIGHT", label: "Sleep night (fixed)" },
];

export function ClockInDialog({
  open,
  onOpenChange,
  eligibility,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eligibility: ClockInEligibilityPayload | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [propertyId, setPropertyId] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("STANDARD");
  const [alternateVenue, setAlternateVenue] = useState(false);
  const [offRosterReason, setOffRosterReason] = useState("");

  const minChars = eligibility?.offRosterMinChars ?? 15;

  useEffect(() => {
    if (!open || !eligibility) return;
    setAlternateVenue(eligibility.eligibleProperties.length === 0);
    setOffRosterReason("");
    const first =
      eligibility.eligibleProperties[0]?.id ?? eligibility.allProperties[0]?.id ?? "";
    setPropertyId(first);
    setShiftType("STANDARD");
  }, [open, eligibility]);

  if (!eligibility) return null;

  const propertyOptions = alternateVenue ? eligibility.allProperties : eligibility.eligibleProperties;
  const selectedPropertyName =
    propertyOptions.find((p) => p.id === propertyId)?.name ??
    eligibility.allProperties.find((p) => p.id === propertyId)?.name ??
    "";
  const needsOffRosterReason =
    alternateVenue ||
    eligibility.expectedPropertyIds.length === 0 ||
    !eligibility.expectedPropertyIds.includes(propertyId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId.trim()) {
      toast.error("Please select a property.");
      return;
    }
    if (needsOffRosterReason && offRosterReason.trim().length < minChars) {
      toast.error(`Add a clear reason (at least ${minChars} characters) for this venue.`);
      return;
    }
    startTransition(() => {
      clockIn(propertyId, shiftType, needsOffRosterReason ? { offRosterReason: offRosterReason.trim() } : undefined)
        .then(() => {
          toast.success("Clocked in");
          onOpenChange(false);
          setPropertyId("");
          setShiftType("STANDARD");
          setAlternateVenue(false);
          setOffRosterReason("");
          router.refresh();
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Clock in failed");
        });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clock in</DialogTitle>
        </DialogHeader>
        <LiveDateTimeDisplay variant="hero" className="mb-1" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          You can normally clock in only at the <strong className="text-foreground">venue on your roster</strong> for
          the visit that covers now (or your next visit within two hours). Use &quot;Different venue&quot; with a
          reason for hospital runs, emergency cover, etc.
        </p>

        {eligibility.rosterWindows.length > 0 ? (
          <div className="rounded-lg border border-[#005EB8]/20 bg-[#E8F4FC]/40 px-3 py-2 text-sm space-y-1.5">
            <p className="font-semibold text-[#005EB8]">Today&apos;s rostered visits</p>
            <ul className="space-y-1.5 list-none m-0 p-0">
              {eligibility.rosterWindows.map((w) => (
                <li key={w.shiftId} className="text-muted-foreground">
                  <span className="text-foreground font-medium">{w.serviceUserName}</span>
                  {" · "}
                  <span className="text-foreground">{w.propertyName}</span>
                  {" · "}
                  <span className="tabular-nums">
                    {format(parseISO(w.startAt), "HH:mm")}–{format(parseISO(w.endAt), "HH:mm")}
                  </span>
                  {w.kind === "early_next" ? (
                    <span className="ml-1 text-xs font-medium text-amber-800">(next)</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            No rostered shift with a venue was found for today. You can still clock in — choose the property and
            describe why (e.g. extra shift agreed with manager).
          </p>
        )}

        {eligibility.missingVenueShifts.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm space-y-1.5">
            <p className="font-semibold text-amber-950">Roster found, but venue is missing</p>
            <p className="text-amber-900 leading-relaxed">
              These shifts don&apos;t have a venue set on the roster (and the service user has no property set), so we
              can&apos;t auto-detect the correct clock-in venue. Ask your manager to set the shift&apos;s property (or the
              service user&apos;s home property).
            </p>
            <ul className="space-y-1 list-none m-0 p-0 text-amber-950">
              {eligibility.missingVenueShifts.slice(0, 6).map((s) => (
                <li key={s.shiftId} className="tabular-nums">
                  {s.serviceUserName} · {format(parseISO(s.startAt), "HH:mm")}–{format(parseISO(s.endAt), "HH:mm")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {eligibility.eligibleProperties.length > 0 ? (
            <label className="flex items-start gap-2 text-sm cursor-pointer touch-manipulation">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0"
                checked={alternateVenue}
                onChange={(e) => {
                  setAlternateVenue(e.target.checked);
                  setPropertyId("");
                  setOffRosterReason("");
                }}
              />
              <span>
                <span className="font-medium text-foreground">Different venue</span>
                <span className="block text-muted-foreground text-xs mt-0.5">
                  Use when you are not at the rostered property (hospital, another home, etc.). All venues will appear
                  and a reason is required.
                </span>
              </span>
            </label>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="clockin-property">Property *</Label>
            <Select
              value={propertyId}
              onValueChange={(v) => {
                setPropertyId(v ?? "");
              }}
              required
            >
              <SelectTrigger id="clockin-property" className="min-h-[44px]">
                <SelectValue placeholder="Select property">
                  {selectedPropertyName || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {propertyOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsOffRosterReason ? (
            <div className="grid gap-2">
              <Label htmlFor="clockin-reason">Reason for this venue *</Label>
              <Textarea
                id="clockin-reason"
                value={offRosterReason}
                onChange={(e) => setOffRosterReason(e.target.value)}
                placeholder="e.g. Escorted service user to A&E; manager asked me to cover X home until 3pm"
                className="min-h-[120px] text-base touch-pan-y"
                required
              />
              <p className="text-xs text-muted-foreground">
                At least {minChars} characters — visible to managers on the audit / hours view.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="clockin-shiftType">Shift type</Label>
            <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
              <SelectTrigger id="clockin-shiftType" className="min-h-[44px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className={cn("gap-2 sm:gap-0")}>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="min-h-[44px] bg-[#005EB8] hover:bg-[#004a94]"
              disabled={pending || !propertyId.trim()}
            >
              {pending ? "Clocking in…" : "Clock in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
