"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations, SUPPORTED_LOCALES, type Locale } from "@/config/translations";

type LanguageContextProps = {
  locale: Locale;
  t: (key: string, variables?: Record<string, string | number>) => string;
  changeLocale: (newLocale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read saved locale from localStorage or Cookie asynchronously to avoid synchronous setState warning
    const initLocale = () => {
      const savedLocale = localStorage.getItem("NEXT_LOCALE") as Locale;
      if (SUPPORTED_LOCALES.some((l) => l.code === savedLocale)) {
        setLocale(savedLocale);
      } else {
        // Try to read cookie
        const cookies = document.cookie.split(";");
        const localeCookie = cookies.find((c) => c.trim().startsWith("NEXT_LOCALE="));
        if (localeCookie) {
          const val = localeCookie.split("=")[1] as Locale;
          if (SUPPORTED_LOCALES.some((l) => l.code === val)) {
            setLocale(val);
          }
        } else {
          // Default fallback to English
          setLocale("en");
        }
      }
      setMounted(true);
    };

    setTimeout(initLocale, 0);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("NEXT_LOCALE", newLocale);
    // Write cookie to sync language selections with serverside renders if any
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
  };

  const t = (key: string, variables?: Record<string, string | number>) => {
    const keys = key.split(".");
    let current: unknown = translations[locale];

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = (current as Record<string, unknown>)[k];
      } else {
        // Fallback to English dictionary if key is missing in active locale
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
  };

  // Suppress hydration warning glitches by rendering children after mount
  return (
    <LanguageContext.Provider value={{ locale, t, changeLocale }}>
      {mounted ? (
        children
      ) : (
        <div style={{ visibility: "hidden" }}>{children}</div>
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
