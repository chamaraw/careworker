import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditLogs } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; action?: string; entity?: string; from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  if ((session.user as { role?: string }).role !== "ADMIN")
    redirect("/dashboard");
  const params = await searchParams;
  const dateFrom = params.from ? new Date(params.from) : undefined;
  const dateTo = params.to ? new Date(params.to) : undefined;
  const logs = await getAuditLogs({
    userId: params.user || undefined,
    action: params.action || undefined,
    entity: params.entity || undefined,
    dateFrom,
    dateTo,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-muted-foreground">
        All actions are recorded with timestamps. Filter by user, action, or entity.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground py-4">No audit entries.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(log.createdAt, "PPp")}
                    </TableCell>
                    <TableCell>
                      {log.user ? `${log.user.name} (${log.user.email})` : "—"}
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.entity}</TableCell>
                    <TableCell className="font-mono text-xs">{log.entityId ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={log.details ?? undefined}>
                      {log.details ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
