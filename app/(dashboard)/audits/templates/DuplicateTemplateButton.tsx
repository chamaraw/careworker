"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { duplicateAuditFormTemplate } from "../actions";

export function DuplicateTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="touch-manipulation min-h-[40px]"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const copy = await duplicateAuditFormTemplate(templateId);
          router.push(`/audits/templates/${copy.id}`);
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Duplicating…" : "Duplicate"}
    </Button>
  );
}
