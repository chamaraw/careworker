"use client";

import { useCallback, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DateSelectArg, EventDropArg } from "@fullcalendar/core";
import { ShiftForm } from "./ShiftForm";
import { ShiftContextNotes } from "./ShiftContextNotes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateShift, deleteShift } from "@/app/(dashboard)/roster/actions";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
};

type Shift = {
  id: string;
  startAt: Date;
  endAt: Date;
  status: string;
  notes: string | null;
  careWorkerId?: string;
  serviceUserId?: string;
  propertyId?: string | null;
  careWorker: { id: string; name: string };
  serviceUser: { id: string; name: string };
  property?: { id: string; name: string } | null;
};

export function RosterCalendar({
  shifts,
  isAdmin,
  careWorkers,
  serviceUsers,
  properties,
}: {
  shifts: Shift[];
  isAdmin: boolean;
  careWorkers: { id: string; name: string }[];
  serviceUsers: { id: string; name: string; propertyId?: string | null }[];
  properties: { id: string; name: string }[];
}) {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);

  const events = shifts.map((s) => ({
    id: s.id,
    title: `${s.serviceUser.name} — ${s.careWorker.name}`,
    start: s.startAt,
    end: s.endAt,
    backgroundColor: statusColor[s.status] ?? "#6b7280",
    borderColor: statusColor[s.status] ?? "#6b7280",
    extendedProps: s,
  }));

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    setSelectedShift(arg.event.extendedProps as Shift);
  }, []);

  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      if (!isAdmin) return;
      setCreateSlot({ start: arg.start, end: arg.end });
    },
    [isAdmin]
  );

  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      if (!isAdmin) return;
      try {
        await updateShift(arg.event.id, {
          startAt: arg.event.start!,
          endAt: arg.event.end!,
        });
      } catch {
        arg.revert();
      }
    },
    [isAdmin]
  );

  return (
    <div className="min-h-[400px]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        eventClick={handleEventClick}
        select={isAdmin ? handleSelect : undefined}
        selectable={isAdmin}
        editable={isAdmin}
        eventDrop={handleEventDrop}
        eventResize={isAdmin ? (arg) => {
          updateShift(arg.event.id, {
            startAt: arg.event.start!,
            endAt: arg.event.end!,
          }).catch(() => arg.revert());
        } : undefined}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="23:00:00"
        buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
      />

      <Dialog open={!!selectedShift} onOpenChange={(o) => !o && setSelectedShift(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto min-h-[48px]">
          <DialogHeader>
            <DialogTitle>Shift details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <p>
                <span className="font-medium">Service user:</span>{" "}
                {selectedShift.serviceUser.name}
              </p>
              <p>
                <span className="font-medium">Care worker:</span>{" "}
                {selectedShift.careWorker.name}
              </p>
              <p>
                <span className="font-medium">Time:</span>{" "}
                {format(selectedShift.startAt, "PPp")} –{" "}
                {format(selectedShift.endAt, "PPp")}
              </p>
              {selectedShift.property && (
                <p>
                  <span className="font-medium">Property:</span>{" "}
                  {selectedShift.property.name}
                </p>
              )}
              <p>
                <span className="font-medium">Status:</span>{" "}
                <Badge>{selectedShift.status}</Badge>
              </p>
              {selectedShift.notes && (
                <p>
                  <span className="font-medium">Shift notes:</span> {selectedShift.notes}
                </p>
              )}
              <ShiftContextNotes
                serviceUserId={selectedShift.serviceUser.id}
                serviceUserName={selectedShift.serviceUser.name}
              />
              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="lg"
                    className="min-h-[48px]"
                    onClick={() => {
                      setEditShift({ ...selectedShift });
                      setSelectedShift(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="min-h-[48px]"
                    onClick={async () => {
                      await deleteShift(selectedShift.id);
                      setSelectedShift(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {createSlot && (
        <ShiftForm
          defaultStart={createSlot.start}
          defaultEnd={createSlot.end}
          careWorkers={careWorkers}
          serviceUsers={serviceUsers}
          properties={properties}
          onClose={() => setCreateSlot(null)}
          onSuccess={() => setCreateSlot(null)}
        />
      )}

      {editShift && (
        <ShiftForm
          shiftId={editShift.id}
          defaultStart={editShift.startAt}
          defaultEnd={editShift.endAt}
          careWorkers={careWorkers}
          serviceUsers={serviceUsers}
          properties={properties}
          initialCareWorkerId={editShift.careWorker?.id ?? editShift.careWorkerId}
          initialServiceUserId={editShift.serviceUser?.id ?? editShift.serviceUserId}
          initialPropertyId={editShift.propertyId ?? editShift.property?.id}
          initialNotes={editShift.notes}
          onClose={() => setEditShift(null)}
          onSuccess={() => setEditShift(null)}
        />
      )}
    </div>
  );
}
