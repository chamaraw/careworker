"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useStaffAssistant } from "@/components/staff-assistant/staff-assistant-context";

export function StaffAssistantFAB() {
  const { setOpen } = useStaffAssistant();
  return (
    <button
      type="button"
      aria-label="Open help assistant"
      className="fixed z-[45] flex items-center gap-2 rounded-full bg-[#005EB8] px-4 py-3 min-h-[48px] text-white shadow-lg touch-manipulation md:bottom-6 md:right-6 right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] hover:bg-[#004a93] active:scale-[0.98] transition-transform"
      onClick={() => setOpen(true)}
    >
      <MessageCircleQuestion className="size-5 shrink-0" aria-hidden />
      <span className="text-sm font-semibold pr-0.5">Help</span>
    </button>
  );
}
