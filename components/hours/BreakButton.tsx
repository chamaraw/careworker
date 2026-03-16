"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Coffee } from "lucide-react";
import { addBreak } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";

export function BreakButton({ onSuccess }: { onSuccess?: () => void }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAddBreak(minutes: number) {
    startTransition(async () => {
      try {
        await addBreak(minutes);
        toast.success(`${minutes} min break added`);
        router.refresh();
        onSuccess?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="body-text-muted text-base">Add break:</span>
      {[15, 30, 60].map((m) => (
        <Button
          key={m}
          variant="outline"
          size="lg"
          className="min-h-[48px] min-w-[44px] text-base font-medium touch-manipulation"
          onClick={() => handleAddBreak(m)}
          disabled={pending}
        >
          <Coffee className="size-5 mr-1.5" aria-hidden />
          {m} min
        </Button>
      ))}
    </div>
  );
}
