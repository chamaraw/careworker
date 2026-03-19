"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RosterPropertyFilter({
  properties,
  isAdmin,
}: {
  properties: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("property") ?? "";

  function onValueChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      next.set("property", value);
    } else {
      next.delete("property");
    }
    router.replace(`/roster?${next.toString()}`, { scroll: false });
  }

  if (properties.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="roster-property" className="text-sm font-medium shrink-0">
        Property
      </Label>
      <Select value={propertyId || "all"} onValueChange={(v) => onValueChange(v ?? "all")}>
        <SelectTrigger id="roster-property" className="w-[200px] min-h-[40px]">
          <SelectValue placeholder="All properties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All properties</SelectItem>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isAdmin && (
        <span className="text-sm text-[var(--muted-foreground)]">
          Drill down to see your shifts at one property
        </span>
      )}
    </div>
  );
}
