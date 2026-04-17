"use client";

import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function AiBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[#00A499]/40 bg-[#00A499]/10 px-2 py-0.5 text-xs font-semibold text-[#005EB8]",
        compact && "px-1.5 py-0 text-[0.65rem]",
        className
      )}
    >
      <SparklesIcon className={cn("text-[#00A499]", compact ? "size-3" : "size-3.5")} aria-hidden />
      AI
    </span>
  );
}
