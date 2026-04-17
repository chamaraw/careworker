"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HolidayRateBoost } from "./actions";
import { createHolidayRateBoost, deleteHolidayRateBoost, updateHolidayRateBoost } from "./actions";

function toDateInputValue(date: Date) {
  // date-fns "yyyy-MM-dd" avoids locale formatting quirks.
  return format(date, "yyyy-MM-dd");
}

export function HolidayRatesClient({ initialBoosts }: { initialBoosts: HolidayRateBoost[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HolidayRateBoost | null>(null);

  const [name, setName] = useState("");
  const [dateStr, setDateStr] = useState(() => toDateInputValue(new Date()));
  const [multiplierStr, setMultiplierStr] = useState("1.5");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const boostsSorted = useMemo(() => {
    return [...initialBoosts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [initialBoosts]);

  function openAdd() {
    setEditing(null);
    setError("");
    setName("");
    setDateStr(toDateInputValue(new Date()));
    setMultiplierStr("1.5");
    setOpen(true);
  }

  function openEdit(boost: HolidayRateBoost) {
    setEditing(boost);
    setError("");
    setName(boost.name);
    setDateStr(toDateInputValue(new Date(boost.date)));
    setMultiplierStr(String(boost.multiplier));
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const multiplier = parseFloat(multiplierStr);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (isNaN(multiplier)) {
      setError("Multiplier must be a number");
      return;
    }

    setPending(true);
    try {
      if (editing) {
        await updateHolidayRateBoost(editing.id, {
          date: dateStr,
          name,
          multiplier,
        });
      } else {
        await createHolidayRateBoost({
          date: dateStr,
          name,
          multiplier,
        });
      }
      toast.success("Holiday rate saved");
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(boost: HolidayRateBoost) {
    if (!confirm(`Delete holiday boost "${boost.name}"?`)) return;
    setPending(true);
    try {
      await deleteHolidayRateBoost(boost.id);
      toast.success("Holiday rate deleted");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="section-title flex items-center gap-2">
          <Plus className="size-5" />
          Holiday rate boosts
        </CardTitle>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Add each date you want to pay above standard (match the UK public holiday dates above, or any
          custom date). Applies to all employees and shift types.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Button type="button" onClick={openAdd} className="gap-2 min-h-[44px]">
            <Plus className="size-4" />
            Add holiday
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit holiday boost" : "Add holiday boost"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSave} className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-h-[48px]"
                    placeholder="Christmas Day"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="min-h-[48px]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="multiplier">Multiplier (e.g. 1.5 = 1.5x)</Label>
                  <Input
                    id="multiplier"
                    type="number"
                    min={0}
                    step={0.01}
                    value={multiplierStr}
                    onChange={(e) => setMultiplierStr(e.target.value)}
                    className="min-h-[48px]"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-[48px]"
                    disabled={pending}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {boostsSorted.length === 0 ? (
          <p className="text-muted-foreground py-4">No holiday boosts configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Multiplier</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boostsSorted.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">{toDateInputValue(new Date(b.date))}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.multiplier.toFixed(2)}x
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => openEdit(b)}
                          disabled={pending}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(b)}
                          disabled={pending}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

