"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createStaff } from "./actions";

export function StaffForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim() || !name.trim()) {
      setError("Email, password, and name are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await createStaff({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: phone.trim() || undefined,
        qualifications: qualifications.trim() || undefined,
      });
      router.refresh();
      setOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      setPhone("");
      setQualifications("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="lg" className="min-h-[48px]">
          Add care worker
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add care worker</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[48px]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[48px]"
              required
              minLength={8}
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
              placeholder="e.g. NVQ Level 2"
              className="min-h-[48px]"
            />
          </div>
          <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
            {pending ? "Saving…" : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
