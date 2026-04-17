import { z } from "zod";

const textareaFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("TEXTAREA"),
  options: z.array(z.string()).max(40).optional(),
});

const yesNoFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("YES_NO"),
});

const dropdownFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("DROPDOWN"),
  options: z.array(z.string()).min(1).max(40),
});

const numberFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("NUMBER"),
  normalMin: z.number().optional(),
  normalMax: z.number().optional(),
  unit: z.string().max(40).optional(),
});

const dateFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("DATE"),
});

const textFieldSchema = z.object({
  key: z.string().max(120),
  label: z.string().max(300),
  type: z.literal("TEXT"),
});

export const wizardQuestionsFieldSchema = z.discriminatedUnion("type", [
  textareaFieldSchema,
  yesNoFieldSchema,
  dropdownFieldSchema,
  numberFieldSchema,
  dateFieldSchema,
  textFieldSchema,
]);

export const wizardComposeFieldSchema = z.discriminatedUnion("type", [
  textareaFieldSchema,
  yesNoFieldSchema,
  dropdownFieldSchema,
  numberFieldSchema,
  dateFieldSchema,
  textFieldSchema,
]);

const serviceUserContextSchema = z
  .object({
    ageBand: z.string().max(80).optional(),
    carePackageSlug: z.string().max(120).optional(),
  })
  .optional();

const wizardQuestionsBodySchema = z.object({
  mode: z.literal("questions"),
  templateId: z.string().max(80),
  templateName: z.string().max(200).optional(),
  field: wizardQuestionsFieldSchema,
  serviceUserContext: serviceUserContextSchema,
});

const answerItemSchema = z.object({
  questionId: z.string().max(80),
  selectedOptionIds: z.array(z.string().max(80)).max(12),
});

const wizardComposeBodySchema = z.object({
  mode: z.literal("compose"),
  templateId: z.string().max(80),
  field: wizardComposeFieldSchema,
  answers: z.array(answerItemSchema).max(12),
  extraNote: z.string().max(2000).optional(),
});

const wizardTextSuggestionsBodySchema = z.object({
  mode: z.literal("text_suggestions"),
  templateId: z.string().max(80),
  templateName: z.string().max(200).optional(),
  field: textFieldSchema,
});

export const wizardRequestSchema = z.discriminatedUnion("mode", [
  wizardQuestionsBodySchema,
  wizardComposeBodySchema,
  wizardTextSuggestionsBodySchema,
]);

export type WizardRequestBody = z.infer<typeof wizardRequestSchema>;

const optionSchema = z.object({
  id: z.string().max(80),
  label: z.string().max(300),
});

const questionSchema = z.object({
  id: z.string().max(80),
  prompt: z.string().max(500),
  allowMultiple: z.boolean(),
  options: z.array(optionSchema).min(2).max(6),
  /** AI-recommended option for this question (staff must still confirm). */
  recommendedOptionId: z.string().max(80).optional(),
});

export const wizardQuestionsResponseSchema = z.object({
  /** Short line shown above chips (“AI asks”). */
  stepIntro: z.string().max(280).optional(),
  questions: z.array(questionSchema).min(1).max(6),
});

export const wizardComposeTextareaResponseSchema = z.object({
  draft: z.string().max(1200),
  /** 1–3 alternative phrasings of the same facts (for staff to pick or edit). */
  alternatives: z.array(z.string().max(1200)).max(3).optional(),
});

export const wizardComposeResolvedResponseSchema = z.object({
  /** Canonical value for the form field (Yes/No, dropdown label, ISO date, number as string, short text). */
  resolvedValue: z.string().max(400),
});

export const wizardTextSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string().max(80)).min(3).max(6),
});
