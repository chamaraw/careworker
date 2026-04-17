"use client";

import { Button } from "@/components/ui/button";
import { useStaffAssistantDraftTarget } from "@/components/staff-assistant/staff-assistant-context";

export function StaffAssistantFieldDraftButton({
  fieldId,
  label,
  onApply,
}: {
  fieldId: string;
  label: string;
  onApply: (text: string) => void;
}) {
  const { requestDraft, available } = useStaffAssistantDraftTarget({ fieldId, label, onApply });
  if (!available) return null;
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto min-h-[44px] p-0 text-sm font-medium text-[#005EB8] touch-manipulation"
      onClick={requestDraft}
    >
      Suggest wording (AI)
    </Button>
  );
}
