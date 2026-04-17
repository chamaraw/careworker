"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg, DateSelectArg, EventDropArg, EventContentArg } from "@fullcalendar/core";
import { ShiftForm } from "./ShiftForm";
import { ShiftContextNotes } from "./ShiftContextNotes";
import { ShiftQuickNotes } from "./ShiftQuickNotes";
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
import { toast } from "sonner";
import { Building2, Clock, GripVertical, User } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColor: Record<string, string> = {
  SCHEDULED: "#005EB8",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#007F3B",
  CANCELLED: "#ef4444",
};

function hslFromId(id: string): { bg: string; border: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    bg: `hsl(${hue} 52% 40%)`,
    border: `hsl(${hue} 52% 28%)`,
  };
}

function colorsForShift(
  s: Shift,
  colorBy: "property" | "staff" | "status"
): { bg: string; border: string } {
  if (colorBy === "status") {
    const c = statusColor[s.status] ?? "#64748b";
    return { bg: c, border: c };
  }
  if (colorBy === "staff") {
    const id = s.careWorkerId ?? s.careWorker.id;
    return hslFromId(id);
  }
  const propKey = s.propertyId ?? s.property?.id ?? `su:${s.serviceUser.id}`;
  return hslFromId(String(propKey));
}

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
  currentUserId,
  careWorkers,
  serviceUsers,
  properties,
  colorBy = "status",
}: {
  shifts: Shift[];
  isAdmin: boolean;
  currentUserId?: string;
  careWorkers: { id: string; name: string }[];
  serviceUsers: { id: string; name: string; propertyId?: string | null }[];
  properties: { id: string; name: string }[];
  colorBy?: "property" | "staff" | "status";
}) {
  const router = useRouter();
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [createSlot, setCreateSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const events = useMemo(
    () =>
      shifts.map((s) => {
        const { bg, border } = colorsForShift(s, colorBy);
        return {
          id: s.id,
          title: `${s.serviceUser.name} — ${s.careWorker.name}`,
          start: s.startAt,
          end: s.endAt,
          backgroundColor: bg,
          borderColor: border,
          extendedProps: { shift: s, colorBy },
        };
      }),
    [shifts, colorBy]
  );

  const handleEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    setSelectedShift((arg.event.extendedProps as { shift: Shift }).shift);
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
        toast.success("Shift moved");
        router.refresh();
      } catch {
        arg.revert();
        toast.error("Could not move shift");
      }
    },
    [isAdmin, router]
  );

  const eventContent = useCallback((arg: EventContentArg) => {
    const s = (arg.event.extendedProps as { shift: Shift }).shift;
    const time = arg.timeText;
    return (
      <div className="fc-event-main-frame px-0.5 py-0.5 overflow-hidden">
        <div className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide opacity-90 font-semibold">
          {arg.view.type.includes("dayGrid") ? null : <Clock className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="truncate">{time}</span>
        </div>
        <div className="text-[11px] sm:text-xs font-semibold leading-snug truncate">{s.serviceUser.name}</div>
        <div className="text-[10px] sm:text-[11px] opacity-95 truncate flex items-center gap-0.5">
          <User className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          {s.careWorker.name}
        </div>
        {s.property?.name ? (
          <div className="text-[10px] truncate flex items-center gap-0.5 opacity-90 mt-0.5">
            <Building2 className="h-3 w-3 shrink-0" aria-hidden />
            {s.property.name}
          </div>
        ) : null}
      </div>
    );
  }, []);

  return (
    <div className="roster-fc-premium rounded-2xl border border-[#005EB8]/20 bg-white shadow-[0_12px_40px_-12px_rgba(0,94,184,0.18)] overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 bg-gradient-to-r from-[#005EB8] via-[#005EB8] to-[#004a94] text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/85">Schedule board</p>
          <p className="text-sm text-white/95 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>Drag shifts in week or day view to reschedule</span>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs">
                <GripVertical className="h-3.5 w-3.5" aria-hidden />
                Admin
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "p-2 sm:p-4 [&_.fc_.fc-button]:min-h-[40px] [&_.fc_.fc-button]:rounded-lg [&_.fc_.fc-button]:font-medium",
          "[&_.fc_.fc-button-primary]:!bg-[#005EB8] [&_.fc_.fc-button-primary]:!border-[#005EB8] [&_.fc_.fc-button-primary:hover]:!bg-[#004a94]",
          "[&_.fc_.fc-toolbar-title]:text-lg [&_.fc_.fc-toolbar-title]:font-semibold [&_.fc_.fc-toolbar-title]:text-slate-800",
          "[&_.fc_.fc-col-header-cell]:bg-[#E8EDEE]/80 [&_.fc_.fc-col-header-cell]:text-slate-800",
          "[&_.fc_.fc-daygrid-day.fc-day-today]:bg-[#E8F4FC]/70",
          "[&_.fc_.fc-list-event:hover]:bg-[#E8F4FC]/50",
          "[&_.fc_.fc-event]:rounded-lg [&_.fc_.fc-event]:border-0 [&_.fc_.fc-event]:shadow-sm",
          "[&_.fc_.fc-scrollgrid]:border-[#005EB8]/12"
        )}
      >
        <div className="min-h-[420px] sm:min-h-[520px]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            events={events}
            eventClick={handleEventClick}
            select={isAdmin ? handleSelect : undefined}
            selectable={isAdmin}
            selectMirror
            editable={isAdmin}
            eventDurationEditable={isAdmin}
            eventDrop={handleEventDrop}
            eventResize={
              isAdmin
                ? async (arg) => {
                    try {
                      await updateShift(arg.event.id, {
                        startAt: arg.event.start!,
                        endAt: arg.event.end!,
                      });
                      toast.success("Shift length updated");
                      router.refresh();
                    } catch {
                      arg.revert();
                      toast.error("Could not update shift");
                    }
                  }
                : undefined
            }
            eventContent={eventContent}
            height="auto"
            slotMinTime="06:00:00"
            slotMaxTime="23:30:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            allDaySlot={false}
            nowIndicator
            dayMaxEvents={4}
            buttonText={{
              today: "Today",
              month: "Month",
              week: "Week",
              day: "Day",
              list: "Agenda",
            }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
            slotLabelFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </div>
      </div>

      <Dialog open={!!selectedShift} onOpenChange={(o) => !o && setSelectedShift(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto min-h-[48px]">
          <DialogHeader>
            <DialogTitle>Shift details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <p>
                <span className="font-medium">Service user:</span> {selectedShift.serviceUser.name}
              </p>
              <p>
                <span className="font-medium">Care worker:</span> {selectedShift.careWorker.name}
              </p>
              <p>
                <span className="font-medium">Time:</span> {format(selectedShift.startAt, "PPp")} –{" "}
                {format(selectedShift.endAt, "PPp")}
              </p>
              {selectedShift.property && (
                <p>
                  <span className="font-medium">Property:</span> {selectedShift.property.name}
                </p>
              )}
              <p>
                <span className="font-medium">Status:</span> <Badge>{selectedShift.status}</Badge>
              </p>
              <ShiftQuickNotes
                key={selectedShift.id}
                shiftId={selectedShift.id}
                initialNotes={selectedShift.notes}
                readOnly={
                  !isAdmin &&
                  !(
                    currentUserId &&
                    (selectedShift.careWorkerId === currentUserId ||
                      selectedShift.careWorker?.id === currentUserId)
                  )
                }
              />
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
                      try {
                        await deleteShift(selectedShift.id);
                        toast.success("Shift deleted");
                        setSelectedShift(null);
                        router.refresh();
                      } catch {
                        toast.error("Could not delete shift");
                      }
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
          onSuccess={() => {
            setCreateSlot(null);
            toast.success("Shift created");
            refresh();
          }}
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
          onSuccess={() => {
            setEditShift(null);
            toast.success("Shift updated");
            refresh();
          }}
        />
      )}
    </div>
  );
}
