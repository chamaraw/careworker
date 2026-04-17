"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RateCardForm } from "./RateCardForm";
import { deleteRateCard } from "./actions";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";

const SHIFT_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  LONE_WORKING: "Lone working",
  AWAKE_NIGHT: "Awake night",
  SLEEP_NIGHT: "Sleep night",
};

type RateCard = Awaited<ReturnType<typeof import("./actions").getRateCards>>[number];

export function RateCardsClient({ rateCards }: { rateCards: RateCard[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RateCard | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(card: RateCard) {
    setEditing(card);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleDelete(card: RateCard) {
    if (!confirm(`Delete rate card "${card.name}"? This cannot be undone.`)) return;
    try {
      await deleteRateCard(card.id);
      toast.success("Rate card deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={openAdd} className="gap-2 min-h-[44px]">
          <Plus className="size-4" />
          Add rate card
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title flex items-center gap-2">
            <CreditCard className="size-5" />
            Rate cards
          </CardTitle>
          <p className="text-sm text-[var(--muted-foreground)]">
            Assign a rate card to staff in Staff edit. Payroll uses these rules by shift type.
          </p>
        </CardHeader>
        <CardContent>
          {rateCards.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-6">
              No rate cards yet. Add one to define pay rules (standard, lone working, sleep night).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead className="text-right">Assigned to</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{card.name}</p>
                          {card.description && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                              {card.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-0.5">
                          {card.rules.map((r) => (
                            <li key={r.shiftType}>
                              {SHIFT_LABELS[r.shiftType] ?? r.shiftType}:{" "}
                              {r.rateType === "FIXED"
                                ? `£${r.fixedAmount ?? 0} fixed`
                                : `£${r.hourlyRate ?? 0}/hr${r.bonusHours ? ` + ${r.bonusHours}h bonus` : ""}`}
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="text-right">
                        {card._count.users} employee{card._count.users !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openEdit(card)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(card)}
                            disabled={card._count.users > 0}
                            title={card._count.users > 0 ? "Unassign from all staff first" : "Delete"}
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

      <RateCardForm open={formOpen} onOpenChange={closeForm} rateCard={editing} />
    </div>
  );
}
