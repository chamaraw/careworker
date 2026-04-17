"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createComplianceDoc, recordReadReceipt } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export function ComplianceClient({
  initial,
}: {
  initial: { id: string; title: string; category: string; expiresAt: string | null; readCount: number }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Policy");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-2 max-w-xl">
        <Input placeholder="Document title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={category} onValueChange={(v) => setCategory(v ?? "Policy")}>
          <SelectTrigger>{category}</SelectTrigger>
          <SelectContent>{["Policy","Procedure","Certificate","License","Insurance","Other"].map((c)=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="File name (e.g. policy.pdf)" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        <Input placeholder="File URL or storage path" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
        <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <Button type="button" disabled={pending || !title || !fileName || !fileUrl} onClick={async () => {
          setPending(true);
          await createComplianceDoc({ title, category, fileName, fileUrl, expiresAt: expiresAt ? new Date(expiresAt) : null });
          setPending(false);
          setTitle("");
          setFileName("");
          setFileUrl("");
          router.refresh();
        }}>{pending ? "Saving..." : "Upload document"}</Button>
      </div>
      <div className="space-y-2">
        {initial.map((d) => {
          const daysLeft = d.expiresAt ? Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000) : null;
          const expiryTone = daysLeft === null ? "text-muted-foreground" : daysLeft <= 30 ? "text-red-600" : daysLeft <= 60 ? "text-amber-600" : "text-green-600";
          return (
            <div key={d.id} className="rounded border p-2 text-sm flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{d.title}</div>
                <div className="text-muted-foreground">{d.category} · read receipts: {d.readCount}</div>
                <div className={expiryTone}>
                  {d.expiresAt ? `Expires ${d.expiresAt.slice(0,10)} (${daysLeft} days)` : "No expiry date"}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={async () => { await recordReadReceipt(d.id); router.refresh(); }}>
                Mark read
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
