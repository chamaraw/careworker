"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateStaff } from "./actions";

type User = {
  id: string;
  name: string;
  phone: string | null;
  qualifications: string | null;
  active: boolean;
};

export function StaffEditForm({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [qualifications, setQualifications] = useState(user.qualifications ?? "");
  const [active, setActive] = useState(user.active);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      await updateStaff(user.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        qualifications: qualifications.trim() || undefined,
        active,
      });
      router.push("/staff");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-[48px]"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qualifications">Qualifications</Label>
        <Input
          id="qualifications"
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-5 rounded border"
        />
        <Label htmlFor="active">Active (can log in and be assigned shifts)</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Link href="/staff">
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
