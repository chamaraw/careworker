"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { updateIncidentStatus } from "@/app/(dashboard)/incidents/actions";
import { createAuditAction } from "@/app/(dashboard)/audits/actions";
import { ScheduleFollowUpDialog } from "./ScheduleFollowUpDialog";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

const severityVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "outline",
  CRITICAL: "destructive",
};

type Incident = {
  id: string;
  severity: string;
  status: string;
  description: string;
  actionTaken: string | null;
  followUpNotes: string | null;
  occurredAt: Date | string;
  serviceUser: { id: string; name: string; propertyId?: string | null };
  careWorker: { name: string };
};

export function IncidentCard({
  incident,
  isAdmin,
}: {
  incident: Incident;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [scheduleFollowUpOpen, setScheduleFollowUpOpen] = useState(false);
  const occurred = incident.occurredAt instanceof Date ? incident.occurredAt : new Date(incident.occurredAt);

  async function handleStatusChange(value: string | null) {
    if (!value) return;
    await updateIncidentStatus(incident.id, value as "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-wrap gap-2">
          <Badge variant={severityVariant[incident.severity] ?? "secondary"}>
            {incident.severity}
          </Badge>
          <Badge variant="outline">{incident.status}</Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {format(occurred, "PPp")}
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{incident.serviceUser.name} — {incident.careWorker.name}</p>
        <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
        {incident.actionTaken && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Action taken:</span> {incident.actionTaken}
          </p>
        )}
        {incident.followUpNotes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Follow-up:</span> {incident.followUpNotes}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[40px] gap-1.5"
            onClick={() => setScheduleFollowUpOpen(true)}
          >
            <CalendarPlus className="size-4" />
            Schedule follow-up
          </Button>
          {isAdmin && incident.serviceUser.propertyId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              onClick={async () => {
                await createAuditAction({
                  propertyId: incident.serviceUser.propertyId as string,
                  description: `Incident follow-up: ${incident.description.slice(0, 120)}`,
                  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  source: "INCIDENT",
                  incidentId: incident.id,
                  priority: incident.severity === "CRITICAL" ? "URGENT" : incident.severity === "HIGH" ? "HIGH" : "MEDIUM",
                });
                router.refresh();
              }}
            >
              Create audit action
            </Button>
          )}
        </div>
        <ScheduleFollowUpDialog
          open={scheduleFollowUpOpen}
          onOpenChange={setScheduleFollowUpOpen}
          serviceUserId={incident.serviceUser.id}
          serviceUserName={incident.serviceUser.name}
          incidentId={incident.id}
        />
        {isAdmin && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm">Status:</span>
            <Select value={incident.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] min-h-[40px]">
                <span className="truncate">
                  {incident.status === "OPEN" ? "Open" : incident.status === "INVESTIGATING" ? "Investigating" : incident.status === "RESOLVED" ? "Resolved" : incident.status === "CLOSED" ? "Closed" : incident.status}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
