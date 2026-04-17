"use client";

import { useRouter } from "next/navigation";
import { updateAuditAction } from "../actions";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function ActionsClient({
  initial,
}: {
  initial: { id: string; description: string; status: string; priority: string }[];
}) {
  const router = useRouter();
  return (
    <div className="space-y-2">
      {initial.map((a) => (
        <div key={a.id} className="rounded border p-3 flex items-center justify-between gap-2">
          <div className="text-sm">{a.description} · {a.priority}</div>
          <Select value={a.status} onValueChange={async (v) => {
            await updateAuditAction(a.id, { status: v as never });
            router.refresh();
          }}>
            <SelectTrigger>{a.status}</SelectTrigger>
            <SelectContent>
              {["OPEN","IN_PROGRESS","DONE","OVERDUE","CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
