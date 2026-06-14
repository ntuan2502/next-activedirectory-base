import { cookies } from "next/headers";
import { translations, type Locale } from "@/config/translations";

export async function getServerLocale(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const savedLocale = cookieStore.get("NEXT_LOCALE")?.value;
    if (savedLocale && savedLocale in translations) {
      return savedLocale;
    }
  } catch {
    // cookies() might throw if called outside request context
  }
  const availableLocales = Object.keys(translations);
  return availableLocales.includes("vi") ? "vi" : (availableLocales[0] || "vi");
}

export function translate(locale: string, key: string, variables?: Record<string, string | number>): string {
  const keys = key.split(".");
  let current: unknown = translations[locale as Locale];

  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = (current as Record<string, unknown>)[k];
    } else {
      let englishFallback: unknown = translations["en"];
      for (const ek of keys) {
        if (englishFallback && typeof englishFallback === "object" && ek in englishFallback) {
          englishFallback = (englishFallback as Record<string, unknown>)[ek];
        } else {
          englishFallback = key;
          break;
        }
      }
      current = englishFallback;
      break;
    }
  }

  if (typeof current !== "string") {
    return key;
  }

  if (variables) {
    let result = current;
    Object.entries(variables).forEach(([varKey, varValue]) => {
      result = result.replace(new RegExp(`{{${varKey}}}`, "g"), String(varValue));
    });
    return result;
  }

  return current;
}

export async function getServerTranslator() {
  const locale = await getServerLocale();
  return {
    locale,
    t: (key: string, variables?: Record<string, string | number>) => translate(locale, key, variables),
  };
}
