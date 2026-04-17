"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  updateProperty,
  createPropertyUnit,
  deletePropertyUnit,
  createPropertyAsset,
  deletePropertyAsset,
  createHsSchedule,
  completeHsInspection,
  createMaintenanceTask,
  updateMaintenanceTask,
  createServiceChargeSchedule,
  createServiceChargePayment,
  updateServiceChargePayment,
  assignServiceUserToUnit,
  exportServiceChargePaymentsCsv,
} from "../actions";
import type {
  HsCheckKind,
  MaintenancePriority,
  MaintenanceTaskStatus,
  ServiceChargeFrequency,
  ServiceChargePaymentStatus,
} from "@prisma/client";

type UnitRow = {
  id: string;
  label: string;
  floor: string | null;
  notes: string | null;
};

type AssetRow = {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
};

type InspectionRow = {
  id: string;
  dueDate: string;
  status: string;
  completedAt: string | null;
  completedBy: { name: string } | null;
};

type ScheduleRow = {
  id: string;
  title: string;
  checkKind: string;
  intervalMonths: number;
  nextDueDate: string;
  isActive: boolean;
  inspections: InspectionRow[];
};

type MaintRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
  unit: { label: string } | null;
  assignee: { name: string } | null;
};

type PayRow = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  amountDue: number;
  amountPaid: number;
  status: string;
  paidAt: string | null;
  reference: string | null;
  serviceUser: { id: string; name: string };
  unit: { label: string } | null;
};

type ChargeSched = {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  payments: PayRow[];
};

type TenantRow = {
  id: string;
  name: string;
  unitId: string | null;
  unit: { label: string } | null;
};

type Initial = {
  name: string;
  address: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  communalAreasNotes: string | null;
  units: UnitRow[];
  assets: AssetRow[];
  hsSchedules: ScheduleRow[];
  maintenanceTasks: MaintRow[];
  serviceChargeSchedules: ChargeSched[];
  serviceUsers: TenantRow[];
};

const HS_KINDS: HsCheckKind[] = [
  "GAS_SAFETY",
  "ELECTRICAL",
  "FIRE_SAFETY",
  "LEGIONELLA",
  "GENERAL",
  "OTHER",
];

const PRIORITIES: MaintenancePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TASK_STATUSES: MaintenanceTaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];
const FREQS: ServiceChargeFrequency[] = ["MONTHLY", "QUARTERLY", "ANNUAL"];
const PAY_STATUSES: ServiceChargePaymentStatus[] = [
  "DUE",
  "PARTIAL",
  "PAID",
  "OVERDUE",
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function HousingDetailClient({
  propertyId,
  initial,
  careWorkers,
}: {
  propertyId: string;
  initial: Initial;
  careWorkers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(fn: () => Promise<void>) {
    setErr("");
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const [editName, setEditName] = useState(initial.name);
  const [editLine1, setEditLine1] = useState(initial.addressLine1 ?? "");
  const [editCity, setEditCity] = useState(initial.city ?? "");
  const [editPost, setEditPost] = useState(initial.postcode ?? "");
  const [editCommunal, setEditCommunal] = useState(
    initial.communalAreasNotes ?? ""
  );

  const [unitLabel, setUnitLabel] = useState("");
  const [unitFloor, setUnitFloor] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetCat, setAssetCat] = useState("");
  const [assetLoc, setAssetLoc] = useState("");

  const [hsTitle, setHsTitle] = useState("");
  const [hsKind, setHsKind] = useState<HsCheckKind>("GENERAL");
  const [hsMonths, setHsMonths] = useState("12");
  const [hsNext, setHsNext] = useState(() => new Date().toISOString().slice(0, 10));

  const [mtTitle, setMtTitle] = useState("");
  const [mtPri, setMtPri] = useState<MaintenancePriority>("MEDIUM");
  const [mtUnit, setMtUnit] = useState<string>("__none__");
  const [mtAssign, setMtAssign] = useState<string>("__none__");
  const [mtDue, setMtDue] = useState("");

  const [scName, setScName] = useState("");
  const [scAmt, setScAmt] = useState("");
  const [scFreq, setScFreq] = useState<ServiceChargeFrequency>("MONTHLY");
  const [scStart, setScStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [payScheduleId, setPayScheduleId] = useState(
    initial.serviceChargeSchedules[0]?.id ?? ""
  );
  const [payTenant, setPayTenant] = useState(initial.serviceUsers[0]?.id ?? "");
  const [payUnit, setPayUnit] = useState<string>("");
  const [payLabel, setPayLabel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payStart, setPayStart] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [payEnd, setPayEnd] = useState(() =>
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10)
  );
  const [payDue, setPayDue] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{initial.name}</h1>
        {err && <p className="text-sm text-destructive mt-2">{err}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Property details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Address line</Label>
              <Input
                value={editLine1}
                onChange={(e) => setEditLine1(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input
                value={editPost}
                onChange={(e) => setEditPost(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Communal areas &amp; H&amp;S context</Label>
            <Textarea
              value={editCommunal}
              onChange={(e) => setEditCommunal(e.target.value)}
              rows={4}
            />
          </div>
          <Button
            type="button"
            disabled={busy}
            className="min-h-[44px]"
            onClick={() =>
              run(() =>
                updateProperty(propertyId, {
                  name: editName,
                  addressLine1: editLine1 || null,
                  city: editCity || null,
                  postcode: editPost || null,
                  communalAreasNotes: editCommunal || null,
                })
              )
            }
          >
            Save property
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tenants &amp; units</CardTitle>
          <p className="text-sm text-muted-foreground">
            Link service users (tenants) to a unit within this property.
          </p>
        </CardHeader>
        <CardContent>
          {initial.serviceUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No service users at this property. Assign a property on the{" "}
              <a href="/service-users" className="underline">
                Service users
              </a>{" "}
              page first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.serviceUsers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>
                      <Select
                        value={t.unitId ?? "__none__"}
                        onValueChange={(v) =>
                          run(() =>
                            assignServiceUserToUnit(
                              t.id,
                              propertyId,
                              v === "__none__" ? null : v
                            )
                          )
                        }
                      >
                        <SelectTrigger className="min-h-[44px] w-[min(100%,14rem)]">
                          {t.unit ? t.unit.label : "Not set"}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {initial.units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Units</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end max-w-xl">
            <div className="space-y-1 flex-1 min-w-[8rem]">
              <Label>Label</Label>
              <Input
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="Flat 12"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1 w-28">
              <Label>Floor</Label>
              <Input
                value={unitFloor}
                onChange={(e) => setUnitFloor(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <Button
              type="button"
              disabled={busy || !unitLabel.trim()}
              className="min-h-[44px]"
              onClick={() =>
                run(async () => {
                  await createPropertyUnit(propertyId, unitLabel, unitFloor);
                  setUnitLabel("");
                  setUnitFloor("");
                })
              }
            >
              Add unit
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.units.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.label}</TableCell>
                  <TableCell>{u.floor ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        run(() => deletePropertyUnit(u.id, propertyId))
                      }
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assets</CardTitle>
          <p className="text-sm text-muted-foreground">
            Boilers, fire panels, lifts — for H&amp;S and maintenance context.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input
                value={assetCat}
                onChange={(e) => setAssetCat(e.target.value)}
                placeholder="Heating"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Location</Label>
              <Input
                value={assetLoc}
                onChange={(e) => setAssetLoc(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={busy || !assetName.trim()}
            className="min-h-[44px]"
            onClick={() =>
              run(async () => {
                await createPropertyAsset(propertyId, {
                  name: assetName,
                  category: assetCat,
                  location: assetLoc,
                });
                setAssetName("");
                setAssetCat("");
                setAssetLoc("");
              })
            }
          >
            Add asset
          </Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.category ?? "—"}</TableCell>
                  <TableCell>{a.location ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        run(() => deletePropertyAsset(a.id, propertyId))
                      }
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">H&amp;S inspection schedules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Gas, electrical, fire, etc. Complete an inspection to roll the next
            due date and create the next record.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={hsTitle}
                onChange={(e) => setHsTitle(e.target.value)}
                placeholder="Annual gas safety"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Check type</Label>
              <Select
                value={hsKind}
                onValueChange={(v) => setHsKind(v as HsCheckKind)}
              >
                <SelectTrigger className="min-h-[44px]">
                  {hsKind.replace(/_/g, " ")}
                </SelectTrigger>
                <SelectContent>
                  {HS_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Interval (months)</Label>
              <Input
                type="number"
                min={1}
                value={hsMonths}
                onChange={(e) => setHsMonths(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Next due</Label>
              <Input
                type="date"
                value={hsNext}
                onChange={(e) => setHsNext(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <Button
                type="button"
                disabled={busy || !hsTitle.trim()}
                className="min-h-[44px]"
                onClick={() =>
                  run(async () => {
                    await createHsSchedule(propertyId, {
                      title: hsTitle,
                      checkKind: hsKind,
                      intervalMonths: parseInt(hsMonths, 10) || 12,
                      nextDueDate: new Date(hsNext),
                      notes: undefined,
                    });
                    setHsTitle("");
                  })
                }
              >
                Add schedule
              </Button>
            </div>
          </div>

          {initial.hsSchedules.map((s) => (
            <div key={s.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center justify-between">
                <div>
                  <span className="font-medium">{s.title}</span>{" "}
                  <Badge variant="secondary">{s.checkKind.replace(/_/g, " ")}</Badge>
                  {!s.isActive && (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  Next due: {fmtDate(s.nextDueDate)} · every {s.intervalMonths} mo
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.inspections.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{fmtDate(i.dueDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            i.status === "COMPLETED" ? "default" : "outline"
                          }
                        >
                          {i.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {i.completedAt
                          ? `${fmtDate(i.completedAt)} · ${i.completedBy?.name ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {i.status !== "COMPLETED" && (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            className="min-h-[40px]"
                            onClick={() =>
                              run(() =>
                                completeHsInspection(i.id, propertyId)
                              )
                            }
                          >
                            Mark complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={mtTitle}
                onChange={(e) => setMtTitle(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select
                value={mtPri}
                onValueChange={(v) => setMtPri(v as MaintenancePriority)}
              >
                <SelectTrigger className="min-h-[44px]">{mtPri}</SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={mtUnit} onValueChange={(v) => setMtUnit(v ?? "__none__")}>
                <SelectTrigger className="min-h-[44px]">
                  {mtUnit !== "__none__"
                    ? initial.units.find((u) => u.id === mtUnit)?.label
                    : "Any / communal"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any / communal</SelectItem>
                  {initial.units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assign to</Label>
              <Select value={mtAssign} onValueChange={(v) => setMtAssign(v ?? "__none__")}>
                <SelectTrigger className="min-h-[44px]">
                  {mtAssign !== "__none__"
                    ? careWorkers.find((c) => c.id === mtAssign)?.name
                    : "Unassigned"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {careWorkers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due (optional)</Label>
              <Input
                type="date"
                value={mtDue}
                onChange={(e) => setMtDue(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <Button
                type="button"
                disabled={busy || !mtTitle.trim()}
                className="min-h-[44px]"
                onClick={() =>
                  run(async () => {
                    await createMaintenanceTask(propertyId, {
                      title: mtTitle,
                      priority: mtPri,
                      unitId: mtUnit === "__none__" ? null : mtUnit,
                      assignedToId: mtAssign === "__none__" ? null : mtAssign,
                      dueAt: mtDue ? new Date(mtDue) : null,
                    });
                    setMtTitle("");
                    setMtUnit("__none__");
                    setMtAssign("__none__");
                    setMtDue("");
                  })
                }
              >
                Add task
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.maintenanceTasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell>{t.unit?.label ?? "—"}</TableCell>
                  <TableCell>{t.assignee?.name ?? "—"}</TableCell>
                  <TableCell>{fmtDate(t.dueAt)}</TableCell>
                  <TableCell>
                    <Select
                      value={t.status}
                      onValueChange={(v) =>
                        run(() =>
                          updateMaintenanceTask(t.id, propertyId, {
                            status: v as MaintenanceTaskStatus,
                          })
                        )
                      }
                    >
                      <SelectTrigger className="min-h-[40px] w-[9rem]">
                        {t.status}
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Service charges</CardTitle>
            <p className="text-sm text-muted-foreground">
              Schedules and per-tenant payments. Export CSV for finance.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="min-h-[44px]"
            onClick={() =>
              run(async () => {
                const csv = await exportServiceChargePaymentsCsv(propertyId);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `service-charges-${propertyId.slice(0, 8)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            Export payments CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl items-end">
            <div className="space-y-1 sm:col-span-2">
              <Label>Schedule name</Label>
              <Input
                value={scName}
                onChange={(e) => setScName(e.target.value)}
                placeholder="Estate management"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={scAmt}
                onChange={(e) => setScAmt(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select
                value={scFreq}
                onValueChange={(v) => setScFreq(v as ServiceChargeFrequency)}
              >
                <SelectTrigger className="min-h-[44px]">{scFreq}</SelectTrigger>
                <SelectContent>
                  {FREQS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={scStart}
                onChange={(e) => setScStart(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div>
              <Button
                type="button"
                disabled={busy || !scName.trim() || !scAmt}
                className="min-h-[44px]"
                onClick={() =>
                  run(async () => {
                    await createServiceChargeSchedule(propertyId, {
                      name: scName,
                      amount: parseFloat(scAmt),
                      frequency: scFreq,
                      startDate: new Date(scStart),
                    });
                    setScName("");
                    setScAmt("");
                  })
                }
              >
                Add schedule
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Record payment row</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl items-end">
              <div className="space-y-1">
                <Label>Schedule</Label>
                <Select value={payScheduleId} onValueChange={(v) => setPayScheduleId(v ?? "")}>
                  <SelectTrigger className="min-h-[44px]">
                    {initial.serviceChargeSchedules.find((s) => s.id === payScheduleId)
                      ?.name ?? "Select"}
                  </SelectTrigger>
                  <SelectContent>
                    {initial.serviceChargeSchedules.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tenant</Label>
                <Select value={payTenant} onValueChange={(v) => setPayTenant(v ?? "")}>
                  <SelectTrigger className="min-h-[44px]">
                    {initial.serviceUsers.find((u) => u.id === payTenant)?.name ??
                      "—"}
                  </SelectTrigger>
                  <SelectContent>
                    {initial.serviceUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unit (optional)</Label>
                <Select value={payUnit} onValueChange={(v) => setPayUnit(v ?? "")}>
                  <SelectTrigger className="min-h-[44px]">
                    {payUnit !== "__none__"
                      ? initial.units.find((u) => u.id === payUnit)?.label
                      : "—"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {initial.units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Period label</Label>
                <Input
                  value={payLabel}
                  onChange={(e) => setPayLabel(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <Label>Period start</Label>
                <Input
                  type="date"
                  value={payStart}
                  onChange={(e) => setPayStart(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <Label>Period end</Label>
                <Input
                  type="date"
                  value={payEnd}
                  onChange={(e) => setPayEnd(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <Label>Amount due (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payDue}
                  onChange={(e) => setPayDue(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div>
                <Button
                  type="button"
                  disabled={
                    busy ||
                    !payScheduleId ||
                    !payTenant ||
                    !payDue ||
                    !payLabel.trim()
                  }
                  className="min-h-[44px]"
                  onClick={() =>
                    run(async () => {
                      await createServiceChargePayment(propertyId, {
                        scheduleId: payScheduleId,
                        serviceUserId: payTenant,
                        unitId: payUnit === "__none__" ? null : payUnit,
                        periodLabel: payLabel,
                        periodStart: new Date(payStart),
                        periodEnd: new Date(payEnd),
                        amountDue: parseFloat(payDue),
                      });
                      setPayDue("");
                    })
                  }
                >
                  Add payment row
                </Button>
              </div>
            </div>
          </div>

          {initial.serviceChargeSchedules.map((sched) => (
            <div key={sched.id} className="space-y-2">
              <div className="flex flex-wrap gap-2 items-baseline">
                <span className="font-medium">{sched.name}</span>
                <span className="text-sm text-muted-foreground">
                  £{sched.amount.toFixed(2)} · {sched.frequency}
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sched.payments.map((p) => (
                    <PaymentRowEditor
                      key={p.id}
                      propertyId={propertyId}
                      payment={p}
                      onDone={() => router.refresh()}
                      busy={busy}
                      setBusy={setBusy}
                      setErr={setErr}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentRowEditor({
  propertyId,
  payment,
  onDone,
  busy,
  setBusy,
  setErr,
}: {
  propertyId: string;
  payment: PayRow;
  onDone: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setErr: (s: string) => void;
}) {
  const [paid, setPaid] = useState(String(payment.amountPaid));
  const [status, setStatus] = useState<ServiceChargePaymentStatus>(
    payment.status as ServiceChargePaymentStatus
  );
  const [paidAt, setPaidAt] = useState(
    payment.paidAt ? payment.paidAt.slice(0, 10) : ""
  );
  const [ref, setRef] = useState(payment.reference ?? "");

  return (
    <TableRow>
      <TableCell>{payment.periodLabel}</TableCell>
      <TableCell>{payment.serviceUser.name}</TableCell>
      <TableCell>{payment.unit?.label ?? "—"}</TableCell>
      <TableCell>£{payment.amountDue.toFixed(2)}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          className="min-h-[40px] w-24"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as ServiceChargePaymentStatus)}
        >
          <SelectTrigger className="min-h-[40px] w-[7rem]">{status}</SelectTrigger>
          <SelectContent>
            {PAY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="date"
          className="min-h-[40px] w-[9rem]"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Input
          className="min-h-[40px] w-28"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ref"
        />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className="min-h-[40px]"
          onClick={async () => {
            setErr("");
            setBusy(true);
            try {
              await updateServiceChargePayment(payment.id, propertyId, {
                amountPaid: parseFloat(paid) || 0,
                status,
                paidAt: paidAt ? new Date(paidAt) : null,
                reference: ref.trim() || null,
              });
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}
