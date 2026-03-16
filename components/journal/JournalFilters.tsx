"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export function JournalFilters({
  careWorkers,
  serviceUsers,
  isAdmin,
  defaultDateFrom,
  defaultDateTo,
}: {
  careWorkers: { id: string; name: string }[];
  serviceUsers: { id: string; name: string }[];
  isAdmin: boolean;
  defaultDateFrom: string;
  defaultDateTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [worker, setWorker] = useState(searchParams.get("worker") ?? "");
  const [serviceUser, setServiceUser] = useState(searchParams.get("serviceUser") ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (worker) params.set("worker", worker);
    if (serviceUser) params.set("serviceUser", serviceUser);
    router.push(`/journal?${params.toString()}`);
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateFrom">From</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-[48px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">To</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-[48px]"
            />
          </div>
          {isAdmin && (
            <>
              <div className="space-y-2">
                <Label>Care worker</Label>
                <Select value={worker} onValueChange={(v) => setWorker(v ?? "")}>
                  <SelectTrigger className="min-h-[48px] w-[180px]">
                    {worker ? (
                      <span className="truncate">{careWorkers.find((w) => w.id === worker)?.name ?? "All"}</span>
                    ) : (
                      <SelectValue placeholder="All" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {careWorkers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service user</Label>
                <Select value={serviceUser} onValueChange={(v) => setServiceUser(v ?? "")}>
                  <SelectTrigger className="min-h-[48px] w-[180px]">
                    {serviceUser ? (
                      <span className="truncate">{serviceUsers.find((u) => u.id === serviceUser)?.name ?? "All"}</span>
                    ) : (
                      <SelectValue placeholder="All" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    {serviceUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Button type="submit" size="lg" className="min-h-[48px]">
            Apply
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
