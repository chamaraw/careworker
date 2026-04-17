export type StaffAssistantFieldGlossary = {
  id: string;
  label: string;
  required?: boolean;
  /** Plain-language guidance; no live values */
  whatGoodLooksLike?: string;
  /** When true, show “Suggest wording” for this field (caller wires apply). */
  insertable?: boolean;
};

export type StaffAssistantPageRegistration = {
  flowId: string;
  fields?: StaffAssistantFieldGlossary[];
  /** Optional snapshot for “share answers” (caller must omit secrets). */
  getShareablePreview?: () => string;
};

export type StaffAssistantDraftTarget = {
  fieldId: string;
  label: string;
  onApply: (text: string) => void;
};

export type StaffAssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};
