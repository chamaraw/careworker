"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** `hero` / `onDark`: large (clock flows). `onDarkPanel`: boxed panel on dark backgrounds. `compact`: light inline strip (forms). `onDarkCompact`: single NHS-style live-time chip for dark heroes (dashboard). */
  variant?: "default" | "hero" | "onDark" | "onDarkPanel" | "onDarkCompact" | "compact";
};

/**
 * Live-updating date and time (UK-style full date + 24h clock with seconds).
 */
export function LiveDateTimeDisplay({ className, variant = "default" }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isHero = variant === "hero" || variant === "onDark";
  const onDarkPanel = variant === "onDarkPanel";
  const onDark = variant === "onDark";
  const onDarkCompact = variant === "onDarkCompact";
  const isCompact = variant === "compact";

  if (onDarkPanel) {
    return (
      <div
        className={cn(
          "rounded-lg border border-white/25 bg-white/10 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-3.5 text-center shadow-inner",
          className
        )}
        aria-live="polite"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/75 mb-1">
          Current date &amp; time
        </p>
        <p className="text-sm sm:text-base font-semibold leading-snug text-white">
          {format(now, "EEEE, d MMMM yyyy")}
        </p>
        <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-[#7FD4E8] mt-1">
          {format(now, "HH:mm:ss")}
        </p>
      </div>
    );
  }

  if (onDarkCompact) {
    return (
      <div
        className={cn(
          "w-full max-w-[20rem] rounded-xl border border-white/20 bg-white/[0.08] backdrop-blur-sm px-3.5 py-2.5 shadow-inner",
          "flex flex-col gap-1.5 min-w-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
          className
        )}
        aria-live="polite"
      >
        <div className="min-w-0 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">Live · UK</p>
          <p className="text-xs font-medium leading-snug text-white/95">{format(now, "EEEE, d MMM yyyy")}</p>
        </div>
        <p className="text-xl font-bold tabular-nums tracking-tight text-[#41B6E6] sm:text-2xl shrink-0">
          {format(now, "HH:mm:ss")}
        </p>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0 rounded-md border border-sky-200/70 bg-white/90 px-2 py-1 text-left dark:border-sky-800/50 dark:bg-slate-950/40",
          className
        )}
        aria-live="polite"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-sky-800/80 dark:text-sky-300/90">
          Now
        </span>
        <span className="text-[11px] text-slate-700 dark:text-slate-200">
          {format(now, "EEE, d MMM yyyy")}
        </span>
        <span className="text-[11px] font-semibold tabular-nums tracking-tight text-[#005EB8] dark:text-[#41B6E6]">
          {format(now, "HH:mm:ss")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        !onDark &&
          "rounded-xl border bg-gradient-to-b from-[#f0f9ff] to-white dark:from-slate-900/80 dark:to-slate-950 border-sky-200/80 dark:border-sky-800/60 px-4 py-4 text-center shadow-sm",
        onDark &&
          "rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm px-5 py-6 sm:px-8 sm:py-8 text-center shadow-inner",
        isHero && !onDark && "px-5 py-6 sm:px-8 sm:py-8",
        className
      )}
      aria-live="polite"
    >
      <p
        className={cn(
          onDark ? "text-white/80" : "text-sky-800/90 dark:text-sky-200/90",
          "font-medium uppercase tracking-[0.12em]",
          isHero ? "text-xs sm:text-sm mb-2" : "text-[10px] mb-1"
        )}
      >
        Current date &amp; time
      </p>
      <p
        className={cn(
          onDark ? "text-white" : "text-slate-800 dark:text-slate-100",
          "font-semibold leading-tight",
          isHero ? "text-xl sm:text-2xl md:text-3xl" : "text-base sm:text-lg"
        )}
      >
        {format(now, "EEEE, d MMMM yyyy")}
      </p>
      <p
        className={cn(
          "font-bold tabular-nums tracking-tight",
          onDark ? "text-[#7FD4E8]" : "text-[#005EB8] dark:text-[#41B6E6]",
          isHero ? "text-4xl sm:text-5xl md:text-6xl mt-2" : "text-3xl sm:text-4xl mt-1.5"
        )}
      >
        {format(now, "HH:mm:ss")}
      </p>
    </div>
  );
}
