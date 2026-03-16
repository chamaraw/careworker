"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Square } from "lucide-react";
import { clockIn, clockOut } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";

export function ClockButton({
  isClockedIn,
  onSuccess,
}: {
  isClockedIn: boolean;
  onSuccess?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(() => {
      (async () => {
        try {
          if (isClockedIn) {
            await clockOut();
            toast.success("Clocked out");
          } else {
            await clockIn();
            toast.success("Clocked in");
          }
          router.refresh();
          onSuccess?.();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Clock in/out failed. Try again.";
          toast.error(msg);
        }
      })();
    });
  }

  return (
    <Button
      size="lg"
      variant={isClockedIn ? "destructive" : "default"}
      className="min-h-[64px] text-lg font-semibold gap-3 px-8 touch-manipulation"
      onClick={handleClick}
      disabled={pending}
    >
      {isClockedIn ? (
        <>
          <Square className="size-6" aria-hidden />
          Clock out
        </>
      ) : (
        <>
          <Clock className="size-6" aria-hidden />
          Clock in
        </>
      )}
    </Button>
  );
}
