"use client";

import { cn } from "@/lib/utils";

export function AiSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-live="polite">
      <p className="text-sm font-medium text-[#005EB8]">AI is preparing your options…</p>
      <div className="flex flex-wrap gap-2">
        {[72, 88, 64].map((w, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-xl bg-[#E8EDEE]"
            style={{ width: `${w}%`, maxWidth: 220, minWidth: 120 }}
          />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
