"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  createFollowUpAction,
  completeFollowUpAction,
  cancelFollowUpAction,
} from "./actions";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, X, ListTodo } from "lucide-react";

type Action = Awaited<ReturnType<typeof import("./actions").getFollowUpActions>>[number];

export function FollowUpsClient({
  initialActions,
  serviceUsers,
}: {
  initialActions: Action[];
  serviceUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [serviceUserId, setServiceUserId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }
    if (!serviceUserId) {
      setError("Select a service user.");
      return;
    }
    const d = dueDate ? new Date(dueDate) : new Date();
    if (isNaN(d.getTime())) {
      setError("Enter a valid date.");
      return;
    }
    setPending(true);
    try {
      await createFollowUpAction({
        serviceUserId,
        description: description.trim(),
        dueDate: d,
      });
      setDescription("");
      setDueDate("");
      setServiceUserId("");
      setAddOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setPending(false);
    }
  }

  async function handleComplete(id: string) {
    await completeFollowUpAction(id);
    router.refresh();
  }

  async function handleCancel(id: string) {
    await cancelFollowUpAction(id);
    router.refresh();
  }

  const pendingActions = initialActions.filter((a) => a.status === "PENDING");
  const completedActions = initialActions.filter((a) => a.status === "COMPLETED");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => setAddOpen(true)}
          className="min-h-[44px] gap-2"
        >
          <CalendarPlus className="size-4" />
          Add follow-up action
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="section-title flex items-center gap-2">
            <ListTodo className="size-5" />
            Pending ({pendingActions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {pendingActions.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No pending follow-ups. Add one or schedule from an incident.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendingActions.map((a) => {
                const due = new Date(a.dueDate);
                const isOverdue = due < new Date() && format(due, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd");
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3 bg-[var(--card)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{a.description}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {a.serviceUser.name}
                        {a.incident && (
                          <span> · From incident</span>
                        )}
                      </p>
                    </div>
                    <Badge variant={isOverdue ? "destructive" : "secondary"}>
                      Due {format(due, "MMM d, yyyy")}
                    </Badge>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 min-h-[36px]"
                        onClick={() => handleComplete(a.id)}
                      >
                        <Check className="size-3.5" />
                        Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 min-h-[36px] text-[var(--muted-foreground)]"
                        onClick={() => handleCancel(a.id)}
                      >
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {completedActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[var(--muted-foreground)]">
              Completed ({completedActions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {completedActions.slice(0, 10).map((a) => (
                <li
                  key={a.id}
                  className="text-sm text-[var(--muted-foreground)] flex justify-between gap-2 py-1"
                >
                  <span className="truncate">{a.description}</span>
                  <span>{a.completedAt ? format(new Date(a.completedAt), "MMM d") : "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add follow-up action</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fu-service">Service user</Label>
              <Select value={serviceUserId || undefined} onValueChange={(v) => setServiceUserId(v ?? "")} required>
                <SelectTrigger id="fu-service" className="min-h-[44px]">
                  <span className={!serviceUserId ? "text-[var(--muted-foreground)]" : ""}>
                    {serviceUserId
                      ? serviceUsers.find((u) => u.id === serviceUserId)?.name ?? "Select"
                      : "Select"}
                  </span>
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
              <Label htmlFor="fu-desc">What needs to be done?</Label>
              <Input
                id="fu-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Review medication"
                className="min-h-[44px]"
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fu-due">Due date</Label>
              <Input
                id="fu-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={today}
                className="min-h-[44px]"
                disabled={pending}
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add follow-up"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
