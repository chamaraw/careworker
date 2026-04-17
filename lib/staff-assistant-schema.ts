import { z } from "zod";

const fieldGlossarySchema = z.object({
  id: z.string().max(120),
  label: z.string().max(200),
  required: z.boolean().optional(),
  whatGoodLooksLike: z.string().max(800).optional(),
  insertable: z.boolean().optional(),
});

export const staffAssistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(12000),
});

export const staffAssistantRequestSchema = z.object({
  pathname: z.string().max(500),
  messages: z.array(staffAssistantMessageSchema).max(40),
  mode: z.enum(["chat", "draft_field"]).default("chat"),
  draftFieldId: z.string().max(120).optional(),
  draftFieldLabel: z.string().max(200).optional(),
  /** User-confirmed optional context; treat as sensitive — server redacts further */
  sharedFormSummary: z.string().max(12000).optional(),
  pageContext: z
    .object({
      flowId: z.string().max(120).optional(),
      fields: z.array(fieldGlossarySchema).max(50).optional(),
    })
    .optional(),
});

export type StaffAssistantRequestBody = z.infer<typeof staffAssistantRequestSchema>;

export const staffAssistantResponseSchema = z.object({
  message: z.string(),
  suggestedNextStep: z.string().optional(),
  draftSuggestion: z.string().optional(),
});

export type StaffAssistantResponseBody = z.infer<typeof staffAssistantResponseSchema>;

export function parseStaffAssistantRequestBody(raw: unknown) {
  return staffAssistantRequestSchema.safeParse(raw);
}
