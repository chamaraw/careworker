"use client";

import { useMemo, useState } from "react";
import { useRegisterStaffAssistantPage } from "@/components/staff-assistant/staff-assistant-context";
import { StaffAssistantFieldDraftButton } from "@/components/staff-assistant/StaffAssistantFieldDraftButton";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateStaff } from "./actions";
import type { ShiftType, RateType } from "@prisma/client";

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "LONE_WORKING", label: "Lone working" },
  { value: "AWAKE_NIGHT", label: "Awake night (hourly)" },
  { value: "SLEEP_NIGHT", label: "Sleep night (fixed)" },
];

type User = {
  id: string;
  name: string;
  phone: string | null;
  qualifications: string | null;
  active: boolean;
  hourlyRate?: number | null;
  rateCardId?: string | null;
  rateOverrides?: Array<{
    shiftType: ShiftType;
    rateType: RateType;
    hourlyRate: number | null;
    fixedAmount: number | null;
    bonusHours: number;
  }>;
};

export function StaffEditForm({
  user,
  rateCards,
}: {
  user: User;
  rateCards: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [qualifications, setQualifications] = useState(user.qualifications ?? "");
  const [active, setActive] = useState(user.active);
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate != null ? String(user.hourlyRate) : "");
  const [rateCardId, setRateCardId] = useState(user.rateCardId ?? "");
  const [overrides, setOverrides] = useState(() => {
    const map = new Map(
      (user.rateOverrides ?? []).map((o) => [
        o.shiftType,
        {
          rateType: o.rateType,
          hourlyRate: o.hourlyRate != null ? String(o.hourlyRate) : "",
          fixedAmount: o.fixedAmount != null ? String(o.fixedAmount) : "",
          bonusHours: String(o.bonusHours),
        },
      ])
    );
    return SHIFT_TYPES.map(({ value }) => ({
      shiftType: value,
      rateType: (map.get(value)?.rateType ?? "HOURLY") as RateType,
      hourlyRate: map.get(value)?.hourlyRate ?? "",
      fixedAmount: map.get(value)?.fixedAmount ?? "",
      bonusHours: map.get(value)?.bonusHours ?? "0",
    }));
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const assistantReg = useMemo(
    () => ({
      flowId: "staff_edit",
      fields: [
        {
          id: "rateCard",
          label: "Rate card",
          whatGoodLooksLike: "Named pay package when this worker should follow standard rules.",
        },
        {
          id: "hourlyRate",
          label: "Fallback hourly rate",
          whatGoodLooksLike: "£/hr used when no card or override applies.",
        },
        {
          id: "qualifications",
          label: "Qualifications",
          insertable: true,
          whatGoodLooksLike: "Brief professional qualifications only.",
        },
        {
          id: "active",
          label: "Active",
          whatGoodLooksLike: "Off when they must not log in or be assigned shifts.",
        },
      ],
      getShareablePreview: () =>
        JSON.stringify(
          {
            name: name.trim(),
            phone: phone.trim() || null,
            qualifications: qualifications.trim() || null,
            active,
            hourlyRate: hourlyRate.trim() || null,
            rateCardId: rateCardId || null,
            rateOverrides: overrides.map((o) => ({
              shiftType: o.shiftType,
              rateType: o.rateType,
              hourlyRate: o.hourlyRate.trim() || null,
              fixedAmount: o.fixedAmount.trim() || null,
              bonusHours: o.bonusHours.trim() || null,
            })),
          },
          null,
          2
        ),
    }),
    [name, phone, qualifications, active, hourlyRate, rateCardId, overrides]
  );
  useRegisterStaffAssistantPage("staff-edit-form", assistantReg);

  function setOverride(shiftType: ShiftType, field: string, value: string | RateType) {
    setOverrides((prev) =>
      prev.map((o) => (o.shiftType === shiftType ? { ...o, [field]: value } : o))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const rate = hourlyRate.trim() ? parseFloat(hourlyRate) : null;
    if (hourlyRate.trim() && (isNaN(rate!) || rate! < 0)) {
      setError("Hourly rate must be a positive number.");
      return;
    }
    const rateOverrides = overrides
      .filter(
        (o) =>
          (o.rateType === "HOURLY" && o.hourlyRate.trim() !== "") ||
          (o.rateType === "FIXED" && o.fixedAmount.trim() !== "")
      )
      .map((o) => ({
        shiftType: o.shiftType,
        rateType: o.rateType,
        hourlyRate: o.hourlyRate.trim() ? parseFloat(o.hourlyRate) : null,
        fixedAmount: o.fixedAmount.trim() ? parseFloat(o.fixedAmount) : null,
        bonusHours: parseFloat(o.bonusHours) || 0,
      }));
    setPending(true);
    try {
      await updateStaff(user.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        qualifications: qualifications.trim() || undefined,
        active,
        hourlyRate: rate ?? null,
        rateCardId: rateCardId.trim() || null,
        rateOverrides,
      });
      router.push("/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-[48px]"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="qualifications">Qualifications</Label>
          <StaffAssistantFieldDraftButton
            fieldId="qualifications"
            label="Qualifications"
            onApply={setQualifications}
          />
        </div>
        <Input
          id="qualifications"
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rateCard">Rate card</Label>
        <Select value={rateCardId} onValueChange={(v) => setRateCardId(v ?? "")}>
          <SelectTrigger id="rateCard" className="max-w-[280px] min-h-[44px]">
            <SelectValue placeholder="None (use fallback rate below)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {rateCards.map((rc) => (
              <SelectItem key={rc.id} value={rc.id}>
                {rc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-[var(--muted-foreground)]">
          Optional. Overrides below apply on top of the rate card.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Rate overrides (optional)</Label>
        <p className="text-xs text-[var(--muted-foreground)] mb-2">
          Override pay for specific shift types for this employee only.
        </p>
        <div className="border rounded-md p-3 space-y-3 bg-[var(--muted)]/30">
          {overrides.map((o) => (
            <div key={o.shiftType} className="flex flex-wrap items-center gap-2">
              <span className="w-[110px] text-sm font-medium">
                {SHIFT_TYPES.find((s) => s.value === o.shiftType)?.label}
              </span>
              <Select
                value={o.rateType}
                onValueChange={(v) => setOverride(o.shiftType, "rateType", v as RateType)}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                </SelectContent>
              </Select>
              {o.rateType === "HOURLY" && (
                <>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="£/hr"
                    className="w-[90px] h-8"
                    value={o.hourlyRate}
                    onChange={(e) => setOverride(o.shiftType, "hourlyRate", e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Bonus hrs"
                    className="w-[80px] h-8"
                    value={o.bonusHours}
                    onChange={(e) => setOverride(o.shiftType, "bonusHours", e.target.value)}
                  />
                </>
              )}
              {o.rateType === "FIXED" && (
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="£ fixed"
                  className="w-[90px] h-8"
                  value={o.fixedAmount}
                  onChange={(e) => setOverride(o.shiftType, "fixedAmount", e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hourlyRate">Fallback hourly rate (£)</Label>
        <Input
          id="hourlyRate"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 11.50"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          className="min-h-[44px] max-w-[140px]"
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          Used when no rate card or override applies (e.g. legacy payroll).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 rounded border"
        />
        <Label htmlFor="active">Active (can log in and be assigned shifts)</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Link href="/staff">
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
