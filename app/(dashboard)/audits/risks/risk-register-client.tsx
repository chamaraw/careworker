"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRiskEntry } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function RiskRegisterClient({
  initial,
  matrix,
}: {
  initial: { id: string; title: string; score: number; status: string; linkedIncidents: number }[];
  matrix: Record<string, number>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [likelihood, setLikelihood] = useState("POSSIBLE");
  const [impact, setImpact] = useState("MODERATE");
  const [pending, setPending] = useState(false);
  const levels = ["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"];
  const impacts = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CATASTROPHIC"];
  const cellColor = (count: number) =>
    count === 0 ? "bg-transparent" : count >= 5 ? "bg-red-200" : count >= 3 ? "bg-orange-200" : "bg-yellow-200";

  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-2">
        <div className="text-sm font-medium">Add risk</div>
        <Input placeholder="Property id" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
        <Input placeholder="Risk title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={likelihood} onValueChange={(v) => setLikelihood(v ?? "POSSIBLE")}><SelectTrigger>{likelihood}</SelectTrigger><SelectContent>{["RARE","UNLIKELY","POSSIBLE","LIKELY","ALMOST_CERTAIN"].map((v)=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
          <Select value={impact} onValueChange={(v) => setImpact(v ?? "MODERATE")}><SelectTrigger>{impact}</SelectTrigger><SelectContent>{["NEGLIGIBLE","MINOR","MODERATE","MAJOR","CATASTROPHIC"].map((v)=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button type="button" disabled={pending || !title || !propertyId} onClick={async () => {
          setPending(true);
          await createRiskEntry({ propertyId, title, category: "Operational", likelihood: likelihood as never, impact: impact as never });
          setTitle("");
          setPending(false);
          router.refresh();
        }}>{pending ? "Saving..." : "Create risk"}</Button>
      </div>

      <div className="rounded border p-3">
        <div className="text-sm font-medium mb-2">Risk matrix (likelihood x impact)</div>
        <div className="overflow-auto">
          <table className="w-full text-xs border">
            <thead>
              <tr>
                <th className="border p-1">Likelihood \\ Impact</th>
                {impacts.map((imp) => <th key={imp} className="border p-1">{imp}</th>)}
              </tr>
            </thead>
            <tbody>
              {levels.map((lvl) => (
                <tr key={lvl}>
                  <td className="border p-1 font-medium">{lvl}</td>
                  {impacts.map((imp) => {
                    const key = `${lvl}:${imp}`;
                    const count = matrix[key] ?? 0;
                    return <td key={key} className={`border p-1 text-center ${cellColor(count)}`}>{count}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        {initial.map((r) => <div key={r.id} className="rounded border p-2">{r.title} · score {r.score} · {r.status} · linked incidents {r.linkedIncidents}</div>)}
      </div>
    </div>
  );
}
