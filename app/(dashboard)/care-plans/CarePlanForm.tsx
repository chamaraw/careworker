"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCarePlan } from "./actions";

export function CarePlanForm({
  serviceUsers,
}: {
  serviceUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [serviceUserId, setServiceUserId] = useState("");
  const [title, setTitle] = useState("");
  const [goals, setGoals] = useState("");
  const [interventions, setInterventions] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !serviceUserId) {
      setError("Title and service user are required.");
      return;
    }
    setPending(true);
    try {
      await createCarePlan({
        serviceUserId,
        title: title.trim(),
        goals: goals.trim() || undefined,
        interventions: interventions.trim() || undefined,
        reviewDate: reviewDate ? new Date(reviewDate) : undefined,
      });
      router.push("/care-plans");
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
        <Label>Service user</Label>
        <Select value={serviceUserId} onValueChange={(v) => v && setServiceUserId(v)} required>
          <SelectTrigger className="min-h-[48px]">
            {serviceUserId ? (
              <span className="truncate">{serviceUsers.find((u) => u.id === serviceUserId)?.name ?? serviceUserId}</span>
            ) : (
              <SelectValue placeholder="Select…" />
            )}
          </SelectTrigger>
          <SelectContent>
            {serviceUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-[48px]"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="goals">Goals</Label>
        <Textarea
          id="goals"
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="interventions">Interventions</Label>
        <Textarea
          id="interventions"
          value={interventions}
          onChange={(e) => setInterventions(e.target.value)}
          className="min-h-[100px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reviewDate">Review date</Label>
        <Input
          id="reviewDate"
          type="date"
          value={reviewDate}
          onChange={(e) => setReviewDate(e.target.value)}
          className="min-h-[48px]"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="min-h-[48px]" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Link href="/care-plans">
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
