import { z } from "zod";
import { wizardQuestionsResponseSchema } from "@/lib/staff-assistant-wizard-schema";

export type CachedWizardQuestions = z.infer<typeof wizardQuestionsResponseSchema>;

const questionsCache = new Map<string, CachedWizardQuestions>();
const textSuggestionsCache = new Map<string, string[]>();

function questionsKey(templateId: string, fieldKey: string, fieldType: string) {
  return `questions:${templateId}:${fieldKey}:${fieldType}`;
}

function textSuggestionsKey(templateId: string, fieldKey: string) {
  return `text_suggestions:${templateId}:${fieldKey}`;
}

export function getCachedWizardQuestions(
  templateId: string,
  fieldKey: string,
  fieldType: string
): CachedWizardQuestions | undefined {
  return questionsCache.get(questionsKey(templateId, fieldKey, fieldType));
}

export function setCachedWizardQuestions(
  templateId: string,
  fieldKey: string,
  fieldType: string,
  data: CachedWizardQuestions
) {
  questionsCache.set(questionsKey(templateId, fieldKey, fieldType), data);
}

export function getCachedTextSuggestions(templateId: string, fieldKey: string): string[] | undefined {
  return textSuggestionsCache.get(textSuggestionsKey(templateId, fieldKey));
}

export function setCachedTextSuggestions(templateId: string, fieldKey: string, suggestions: string[]) {
  textSuggestionsCache.set(textSuggestionsKey(templateId, fieldKey), suggestions);
}
