import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAuditActions } from "../actions";
import { ActionsClient } from "./actions-client";

export default async function AuditActionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const actions = await getAuditActions({});
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit actions</h1>
      <ActionsClient initial={actions.map((a) => ({ id: a.id, description: a.description, status: a.status, priority: a.priority }))} />
    </div>
  );
}
