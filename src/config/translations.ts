import { en } from "./locales/en";
import { vi } from "./locales/vi";
import { th } from "./locales/th";
import { ja } from "./locales/ja";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English", localeStr: "en-US", am: "AM", pm: "PM", justNow: "just now" },
  { code: "vi", label: "Tiếng Việt", localeStr: "vi-VN", am: "SA", pm: "CH", justNow: "vừa xong" },
  { code: "th", label: "ไทย (Thai)", localeStr: "th-TH", am: "ก่อนเที่ยง", pm: "หลังเที่ยง", justNow: "เมื่อครู่" },
  { code: "ja", label: "日本語 (Japanese)", localeStr: "ja-JP", am: "午前", pm: "午後", justNow: "たった今" },
] as const;

export type Locale = typeof SUPPORTED_LOCALES[number]["code"];

export const translations: Record<Locale, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  vi: vi as unknown as Record<string, unknown>,
  th: th as unknown as Record<string, unknown>,
  ja: ja as unknown as Record<string, unknown>,
};

