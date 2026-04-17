"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AiBadge } from "@/components/staff-assistant/AiBadge";
import { cn } from "@/lib/utils";

export function AiDraftCard({
  title,
  bodyText,
  bodySlot,
  pending,
  onRegenerate,
  onRefine,
  showEditWording,
  editWordingOpen,
  onToggleEditWording,
  editWordingValue,
  onEditWordingChange,
  editWordingPlaceholder,
}: {
  title: string;
  /** Shown when bodySlot is not provided. */
  bodyText?: string;
  /** When set, replaces the read-only body block (e.g. textarea + chip picker). */
  bodySlot?: ReactNode;
  pending?: boolean;
  onRegenerate: () => void;
  onRefine: () => void;
  showEditWording: boolean;
  editWordingOpen: boolean;
  onToggleEditWording: () => void;
  editWordingValue: string;
  onEditWordingChange: (v: string) => void;
  editWordingPlaceholder?: string;
}) {
  return (
    <div className="space-y-4 rounded-xl border-2 border-[#00A499]/35 bg-[#E8F4FC]/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AiBadge />
          <h3 className="text-base font-semibold text-[#005EB8]">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] touch-manipulation"
            disabled={pending}
            onClick={onRefine}
          >
            Refine answers
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] touch-manipulation"
            disabled={pending}
            onClick={onRegenerate}
          >
            {pending ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </div>
      {bodySlot ? (
        <div className="space-y-3">{bodySlot}</div>
      ) : (
        <div
          className={cn(
            "rounded-lg border border-[#005EB8]/20 bg-white px-3 py-3 text-base leading-relaxed text-slate-900 whitespace-pre-wrap",
            "min-h-[120px]"
          )}
        >
          {bodyText || "—"}
        </div>
      )}
      {showEditWording ? (
        <div className="rounded-lg border border-[#E8EDEE] bg-white">
          <button
            type="button"
            className="flex w-full min-h-[48px] items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-[#005EB8] touch-manipulation"
            onClick={onToggleEditWording}
          >
            Edit wording
            <ChevronDownIcon
              className={cn("size-5 shrink-0 transition-transform", editWordingOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {editWordingOpen ? (
            <div className="border-t border-[#E8EDEE] p-3 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Only open if you need to tweak the text. Keep factual; avoid unnecessary identifiers.
              </p>
              <Textarea
                value={editWordingValue}
                onChange={(e) => onEditWordingChange(e.target.value)}
                className="min-h-[200px] text-base touch-pan-y"
                placeholder={editWordingPlaceholder}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
