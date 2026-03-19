"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function PerformanceFilters({
  workers,
  properties,
  defaultWorkerId,
  defaultPropertyId,
  defaultDateFrom,
  defaultDateTo,
}: {
  workers: { id: string; name: string }[];
  properties: { id: string; name: string }[];
  defaultWorkerId: string | undefined;
  defaultPropertyId: string | undefined;
  defaultDateFrom: string;
  defaultDateTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const params = new URLSearchParams();
    const worker = (form.elements.namedItem("worker") as HTMLSelectElement)?.value;
    const property = (form.elements.namedItem("property") as HTMLSelectElement)?.value;
    const dateFrom = (form.elements.namedItem("dateFrom") as HTMLInputElement)?.value;
    const dateTo = (form.elements.namedItem("dateTo") as HTMLInputElement)?.value;
    if (worker) params.set("worker", worker);
    if (property) params.set("property", property);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/performance?${params.toString()}`);
  }

  const workerValue = searchParams.get("worker") ?? defaultWorkerId ?? "";
  const propertyValue = searchParams.get("property") ?? defaultPropertyId ?? "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label>Care worker</Label>
        <Select
          name="worker"
          value={workerValue}
          onValueChange={(v) => {
            const p = new URLSearchParams(searchParams);
            if (v) p.set("worker", v);
            else p.delete("worker");
            router.push(`/performance?${p.toString()}`);
          }}
        >
          <SelectTrigger className="min-h-[48px] w-[200px]">
            {workerValue ? (
              <span className="truncate">{workers.find((w) => w.id === workerValue)?.name ?? "All"}</span>
            ) : (
              <span className="text-[var(--muted-foreground)]">All workers</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All workers</SelectItem>
            {workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Property</Label>
        <Select
          name="property"
          value={propertyValue}
          onValueChange={(v) => {
            const p = new URLSearchParams(searchParams);
            if (v) p.set("property", v);
            else p.delete("property");
            router.push(`/performance?${p.toString()}`);
          }}
        >
          <SelectTrigger className="min-h-[48px] w-[200px]">
            {propertyValue ? (
              <span className="truncate">{properties.find((p) => p.id === propertyValue)?.name ?? "All"}</span>
            ) : (
              <span className="text-[var(--muted-foreground)]">All properties</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="perf-dateFrom">From</Label>
        <Input
          id="perf-dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={defaultDateFrom}
          className="min-h-[48px] w-[160px]"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="perf-dateTo">To</Label>
        <Input
          id="perf-dateTo"
          name="dateTo"
          type="date"
          defaultValue={defaultDateTo}
          className="min-h-[48px] w-[160px]"
        />
      </div>
      <Button type="submit" size="lg" className="min-h-[48px]">
        Apply
      </Button>
    </form>
  );
}
