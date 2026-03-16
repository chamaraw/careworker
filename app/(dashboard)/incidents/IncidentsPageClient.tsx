"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { IncidentForm } from "@/components/incidents/IncidentForm";

export function IncidentsPageClient({
  serviceUsers,
  children,
}: {
  serviceUsers: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [formOpen, setFormOpen] = useState(false);
  return (
    <>
      <div className="flex gap-2 mb-4">
        <Button
          size="lg"
          className="min-h-[48px] gap-2"
          onClick={() => setFormOpen(true)}
        >
          <AlertTriangle className="size-5" />
          Report incident
        </Button>
      </div>
      {formOpen && (
        <IncidentForm
          serviceUsers={serviceUsers}
          onClose={() => setFormOpen(false)}
          onSuccess={() => setFormOpen(false)}
        />
      )}
      {children}
    </>
  );
}
