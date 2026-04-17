"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createDefaultAuditTemplates } from "../actions";

export function LoadDefaultTemplatesButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          setMessage("");
          try {
            const res = await createDefaultAuditTemplates();
            setMessage(res.created > 0 ? `Added ${res.created} predefined templates.` : "Predefined templates already exist.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load templates");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Loading..." : "Load predefined templates"}
      </Button>
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

