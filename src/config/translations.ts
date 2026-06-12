import { en } from "./locales/en";
import { vi } from "./locales/vi";

export type TranslationKey = string;

export const translations: Record<string, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  vi: vi as unknown as Record<string, unknown>,
};

