"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, Square } from "lucide-react";
import { clockOut } from "@/app/(dashboard)/hours/actions";
import { toast } from "sonner";

type ClockButtonProps = {
  isClockedIn: boolean;
  onSuccess?: () => void;
  /** Opens clock-in dialog (property + shift type) instead of calling API directly. */
  whenNotClockedInClick?: () => void;
  /** Opens clock-out confirmation with large time display instead of immediate clock-out. */
  whenClockedInClick?: () => void;
  disabled?: boolean;
};

export function ClockButton({
  isClockedIn,
  onSuccess,
  whenNotClockedInClick,
  whenClockedInClick,
  disabled,
}: ClockButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!isClockedIn) {
      if (whenNotClockedInClick) {
        whenNotClockedInClick();
      } else {
        toast.error("Clock-in requires a property. Use the Hours page to clock in.");
      }
      return;
    }
    if (whenClockedInClick) {
      whenClockedInClick();
      return;
    }
    startTransition(() => {
      (async () => {
        try {
          await clockOut();
          toast.success("Clocked out");
          router.refresh();
          onSuccess?.();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Clock out failed. Try again.";
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
      disabled={pending || disabled}
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
