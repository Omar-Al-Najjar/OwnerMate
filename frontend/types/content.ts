import type { Locale } from "@/types/settings";

export type GenerationMode = "marketing_content";

export type GeneratedContentDraft = {
  id: string;
  mode: GenerationMode;
  language: Locale;
  generatedText: string;
  editableText: string;
};
