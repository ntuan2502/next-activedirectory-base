"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "@/config/translations";

type Locale = "en" | "vi";

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
    // Read saved locale from localStorage or Cookie
    const savedLocale = localStorage.getItem("NEXT_LOCALE") as Locale;
    if (savedLocale === "en" || savedLocale === "vi") {
      setLocale(savedLocale);
    } else {
      // Try to read cookie
      const cookies = document.cookie.split(";");
      const localeCookie = cookies.find((c) => c.trim().startsWith("NEXT_LOCALE="));
      if (localeCookie) {
        const val = localeCookie.split("=")[1] as Locale;
        if (val === "en" || val === "vi") {
          setLocale(val);
        }
      } else {
        // Fallback to navigator language
        const navLang = navigator.language.split("-")[0];
        if (navLang === "vi") {
          setLocale("vi");
        }
      }
    }
    setMounted(true);
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("NEXT_LOCALE", newLocale);
    // Write cookie to sync language selections with serverside renders if any
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
  };

  const t = (key: string, variables?: Record<string, string | number>) => {
    const keys = key.split(".");
    let current: any = translations[locale];

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // Fallback to English dictionary if key is missing in active locale
        let englishFallback: any = translations["en"];
        for (const ek of keys) {
          if (englishFallback && typeof englishFallback === "object" && ek in englishFallback) {
            englishFallback = englishFallback[ek];
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
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <LanguageContext.Provider value={{ locale, t, changeLocale }}>
      {children}
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
