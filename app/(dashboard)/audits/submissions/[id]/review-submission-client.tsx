"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewFormSubmission } from "../../actions";

export function ReviewSubmissionClient({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-2">
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes" />
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await reviewFormSubmission(submissionId, notes);
          setPending(false);
          router.refresh();
        }}
      >
        {pending ? "Saving..." : "Mark reviewed"}
      </Button>
    </div>
  );
}
