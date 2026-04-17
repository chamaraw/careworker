import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRiskEntries, getRiskMatrixData } from "../actions";
import { RiskRegisterClient } from "./risk-register-client";

export default async function RisksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/dashboard");
  const [risks, matrix] = await Promise.all([getRiskEntries({}), getRiskMatrixData()]);
  const riskRows = risks as { id: string; title: string; riskScore: number; status: string; reviewDate?: Date | null; incidentLinks?: { id: string }[] }[];
  const reviewDue = riskRows.filter((r) => r.reviewDate && new Date(r.reviewDate).getTime() < Date.now()).length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Risk register</h1>
      <div className="rounded border p-3 text-sm">
        Open risks: {riskRows.filter((r) => r.status !== "CLOSED").length} · Review due: {reviewDue}
      </div>
      <RiskRegisterClient
        initial={riskRows.map((r) => ({ id: r.id, title: r.title, score: r.riskScore, status: r.status, linkedIncidents: r.incidentLinks?.length ?? 0 }))}
        matrix={matrix.matrix}
      />
    </div>
  );
}
