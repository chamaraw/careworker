"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createRateCard, updateRateCard } from "./actions";
import { toast } from "sonner";
import type { ShiftType, RateType } from "@prisma/client";

const SHIFT_TYPES: { value: ShiftType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "LONE_WORKING", label: "Lone working" },
  { value: "SLEEP_NIGHT", label: "Sleep night" },
];

type RuleRow = {
  shiftType: ShiftType;
  rateType: RateType;
  hourlyRate: string;
  fixedAmount: string;
  bonusHours: string;
};

type RateCardWithRules = {
  id: string;
  name: string;
  description: string | null;
  rules: Array<{
    shiftType: ShiftType;
    rateType: RateType;
    hourlyRate: number | null;
    fixedAmount: number | null;
    bonusHours: number;
  }>;
};

const defaultRules: RuleRow[] = SHIFT_TYPES.map(({ value }) => ({
  shiftType: value,
  rateType: "HOURLY" as RateType,
  hourlyRate: "",
  fixedAmount: "",
  bonusHours: "0",
}));

function ruleRowToInput(r: RuleRow) {
  return {
    shiftType: r.shiftType,
    rateType: r.rateType,
    hourlyRate: r.hourlyRate ? parseFloat(r.hourlyRate) : null,
    fixedAmount: r.fixedAmount ? parseFloat(r.fixedAmount) : null,
    bonusHours: parseFloat(r.bonusHours) || 0,
  };
}

export function RateCardForm({
  open,
  onOpenChange,
  rateCard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateCard: RateCardWithRules | null;
}) {
  const router = useRouter();
  const isEdit = !!rateCard;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<RuleRow[]>(defaultRules);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      if (rateCard) {
        setName(rateCard.name);
        setDescription(rateCard.description ?? "");
        const ruleMap = new Map(rateCard.rules.map((r) => [r.shiftType, r]));
        setRules(
          SHIFT_TYPES.map(({ value }) => {
            const r = ruleMap.get(value);
            return {
              shiftType: value,
              rateType: r?.rateType ?? "HOURLY",
              hourlyRate: r?.hourlyRate != null ? String(r.hourlyRate) : "",
              fixedAmount: r?.fixedAmount != null ? String(r.fixedAmount) : "",
              bonusHours: r?.bonusHours != null ? String(r.bonusHours) : "0",
            };
          })
        );
      } else {
        setName("");
        setDescription("");
        setRules(defaultRules);
      }
    }
  }, [open, rateCard]);

  function setRule(shiftType: ShiftType, field: keyof RuleRow, value: string | RateType) {
    setRules((prev) =>
      prev.map((r) =>
        r.shiftType === shiftType ? { ...r, [field]: value } : r
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    const ruleInputs = rules.map(ruleRowToInput);
    for (const r of ruleInputs) {
      if (r.rateType === "HOURLY" && r.hourlyRate == null) {
        toast.error("Set hourly rate for all HOURLY shift types");
        return;
      }
      if (r.rateType === "FIXED" && r.fixedAmount == null) {
        toast.error("Set fixed amount for all FIXED shift types");
        return;
      }
    }
    setPending(true);
    try {
      if (isEdit && rateCard) {
        await updateRateCard(rateCard.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          rules: ruleInputs,
        });
        toast.success("Rate card updated");
      } else {
        await createRateCard({
          name: name.trim(),
          description: description.trim() || undefined,
          rules: ruleInputs,
        });
        toast.success("Rate card created");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rate card" : "Add rate card"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="rc-name">Name</Label>
            <Input
              id="rc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard Care Worker"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rc-desc">Description (optional)</Label>
            <Textarea
              id="rc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
              placeholder="Optional notes"
            />
          </div>
          <div>
            <Label className="mb-2 block">Rules per shift type</Label>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Shift type</TableHead>
                    <TableHead className="w-[90px]">Rate type</TableHead>
                    <TableHead>Hourly (£)</TableHead>
                    <TableHead>Fixed (£)</TableHead>
                    <TableHead className="w-[80px]">Bonus hrs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.shiftType}>
                      <TableCell className="font-medium">
                        {SHIFT_TYPES.find((s) => s.value === r.shiftType)?.label ?? r.shiftType}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.rateType}
                          onValueChange={(v) => setRule(r.shiftType, "rateType", v as RateType)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOURLY">Hourly</SelectItem>
                            <SelectItem value="FIXED">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          className="h-8"
                          value={r.rateType === "HOURLY" ? r.hourlyRate : ""}
                          onChange={(e) => setRule(r.shiftType, "hourlyRate", e.target.value)}
                          disabled={r.rateType === "FIXED"}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          className="h-8"
                          value={r.rateType === "FIXED" ? r.fixedAmount : ""}
                          onChange={(e) => setRule(r.shiftType, "fixedAmount", e.target.value)}
                          disabled={r.rateType === "HOURLY"}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          className="h-8"
                          value={r.bonusHours}
                          onChange={(e) => setRule(r.shiftType, "bonusHours", e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Bonus hours: extra hours of pay (e.g. 3 for lone working). Fixed: one amount per shift (e.g. sleep night).
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create rate card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
