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
import { updateCarePlan } from "./actions";
import { format } from "date-fns";

type Plan = {
  id: string;
  title: string;
  goals: string | null;
  interventions: string | null;
  reviewDate: Date | null;
  status: string;
};

export function CarePlanEditForm({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [title, setTitle] = useState(plan.title);
  const [goals, setGoals] = useState(plan.goals ?? "");
  const [interventions, setInterventions] = useState(plan.interventions ?? "");
  const [reviewDate, setReviewDate] = useState(
    plan.reviewDate ? format(plan.reviewDate, "yyyy-MM-dd") : ""
  );
  const [status, setStatus] = useState(plan.status);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setPending(true);
    try {
      await updateCarePlan(plan.id, {
        title: title.trim(),
        goals: goals.trim() || "",
        interventions: interventions.trim() || "",
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        status: status as "ACTIVE" | "UNDER_REVIEW" | "COMPLETED" | "ARCHIVED",
      });
      router.push(`/care-plans/${plan.id}`);
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
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger className="min-h-[48px]">
            {status ? (
              <span className="truncate">
                {status === "ACTIVE" ? "Active" : status === "UNDER_REVIEW" ? "Under review" : status === "COMPLETED" ? "Completed" : status === "ARCHIVED" ? "Archived" : status}
              </span>
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under review</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
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
        <Link href={`/care-plans/${plan.id}`}>
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
