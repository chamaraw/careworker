import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PropertyTemplateBreakdownRow } from "../../manager/manager-actions";
import { MANAGER_FILING_WINDOW_DAYS } from "../../manager/manager-constants";

function formatUkDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: PropertyTemplateBreakdownRow["rowStatus"] }) {
  if (status === "COMPLETE") {
    return <Badge className="bg-[#007F3B] hover:bg-[#006b32]">Filed ({MANAGER_FILING_WINDOW_DAYS}d)</Badge>;
  }
  if (status === "OVERDUE") {
    return <Badge className="bg-red-600 hover:bg-red-600">Schedule overdue</Badge>;
  }
  return <Badge className="bg-amber-600 hover:bg-amber-600 text-white">Not filed ({MANAGER_FILING_WINDOW_DAYS}d)</Badge>;
}

export function PropertyTemplateBreakdown({
  propertyId,
  rows,
}: {
  propertyId: string;
  rows: PropertyTemplateBreakdownRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#005EB8]/30 bg-[#E8F4FC]/20 p-4 text-sm text-muted-foreground leading-relaxed">
        No forms are <strong className="text-foreground">enabled</strong> for this property yet. In{" "}
        <strong className="text-foreground">Assigned templates</strong> above, choose{" "}
        <strong className="text-foreground">Add to property</strong> for each form you need, or use{" "}
        <strong className="text-foreground">Enable all forms for this property</strong>. Enabled forms show here and in{" "}
        <strong className="text-foreground">Audit recording</strong> for staff.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Each row is an <strong className="text-foreground">enabled</strong> template for this venue.{" "}
        <strong className="text-foreground">Filed ({MANAGER_FILING_WINDOW_DAYS}d)</strong> means at least one submitted
        report in that window. <strong className="text-foreground">Schedule overdue</strong> uses an active audit schedule
        with a past <em>next due</em> date for that template.
      </p>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-[#005EB8]/15">
              <TableHead className="text-[#005EB8] font-semibold min-w-[10rem]">Template</TableHead>
              <TableHead className="text-[#005EB8] font-semibold">Status</TableHead>
              <TableHead className="text-[#005EB8] font-semibold whitespace-nowrap">Last filed</TableHead>
              <TableHead className="text-[#005EB8] font-semibold">Filed by</TableHead>
              <TableHead className="text-[#005EB8] font-semibold whitespace-nowrap">Next due (schedule)</TableHead>
              <TableHead className="text-[#005EB8] font-semibold text-right min-w-[12rem]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.formTemplateId} className="border-[#005EB8]/10">
                <TableCell className="font-medium text-slate-900">{r.templateName}</TableCell>
                <TableCell>
                  <StatusBadge status={r.rowStatus} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                  {formatUkDateTime(r.lastSubmittedAt)}
                </TableCell>
                <TableCell className="text-sm">{r.lastSubmittedByName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                  {r.scheduleNextDue ? formatUkDateTime(r.scheduleNextDue) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.lastSubmissionId ? (
                      <Link
                        href={`/audits/submissions/${r.lastSubmissionId}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "min-h-[40px] touch-manipulation inline-flex items-center justify-center"
                        )}
                      >
                        View last report
                      </Link>
                    ) : null}
                    <Link
                      href={`/audits/submit/${r.formTemplateId}?propertyId=${encodeURIComponent(propertyId)}`}
                      className={cn(
                        buttonVariants({ variant: "default", size: "sm" }),
                        "min-h-[40px] touch-manipulation inline-flex items-center justify-center bg-[#005EB8] hover:bg-[#004a94] text-primary-foreground"
                      )}
                    >
                      Start recording
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
