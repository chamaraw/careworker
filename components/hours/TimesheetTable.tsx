"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setApproval, deleteTimeRecord } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";
import { EditTimeRecordDialog } from "./EditTimeRecordDialog";
import { Pencil, Trash2 } from "lucide-react";

type Record = {
  id: string;
  clockInAt: Date | string;
  clockOutAt: Date | string | null;
  breakMinutes: number;
  totalMinutes: number | null;
  approvalStatus: string;
  notes?: string | null;
  user?: { name: string };
};

export function TimesheetTable({
  records,
  isAdmin,
}: {
  records: Record[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editRecord, setEditRecord] = useState<Record | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const router = useRouter();

  function handleApproval(id: string, status: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      try {
        await setApproval(id, status);
        toast.success(status === "APPROVED" ? "Approved" : "Rejected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function handleEdit(r: Record) {
    setEditRecord(r);
    setEditOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this time record? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteTimeRecord(id);
        toast.success("Time record deleted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (records.length === 0) {
    return <p className="body-text-muted py-5">No time records.</p>;
  }

  const showWorkerActions = !isAdmin;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {isAdmin && <TableHead className="text-base font-semibold">Worker</TableHead>}
            <TableHead className="text-base font-semibold">Shift (start – end)</TableHead>
            <TableHead className="text-base font-semibold">Break</TableHead>
            <TableHead className="text-base font-semibold">Total</TableHead>
            {isAdmin && <TableHead className="text-base font-semibold">Status</TableHead>}
            <TableHead className="w-[140px] text-base font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => {
            const clockIn = r.clockInAt instanceof Date ? r.clockInAt : new Date(r.clockInAt);
            const clockOut = r.clockOutAt ? (r.clockOutAt instanceof Date ? r.clockOutAt : new Date(r.clockOutAt)) : null;
            const total = r.totalMinutes != null ? `${(r.totalMinutes / 60).toFixed(1)} h` : "—";
            const shiftLabel = clockOut
              ? `${format(clockIn, "d MMM yyyy, HH:mm")} – ${format(clockOut, "HH:mm")}`
              : `${format(clockIn, "d MMM yyyy, HH:mm")} – —`;
            return (
              <TableRow key={r.id} className="text-base">
                {isAdmin && r.user && <TableCell className="font-medium">{r.user.name}</TableCell>}
                <TableCell title={`Clock in: ${format(clockIn, "PPp")}${clockOut ? ` · Clock out: ${format(clockOut, "PPp")}` : ""}`}>
                  {shiftLabel}
                </TableCell>
                <TableCell>{r.breakMinutes} min</TableCell>
                <TableCell className="font-medium">{total}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <Badge variant={r.approvalStatus === "APPROVED" ? "default" : r.approvalStatus === "REJECTED" ? "destructive" : "secondary"}>
                      {r.approvalStatus}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  {isAdmin && r.approvalStatus === "PENDING" && (
                    <div className="flex gap-1">
                      <Button size="sm" disabled={pending} onClick={() => handleApproval(r.id, "APPROVED")}>Approve</Button>
                      <Button size="sm" variant="destructive" disabled={pending} onClick={() => handleApproval(r.id, "REJECTED")}>Reject</Button>
                    </div>
                  )}
                  {showWorkerActions && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => handleEdit(r)} className="min-h-[36px]">
                        <Pencil className="size-4 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleDelete(r.id)} className="min-h-[36px] text-destructive hover:text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <EditTimeRecordDialog record={editRecord} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
