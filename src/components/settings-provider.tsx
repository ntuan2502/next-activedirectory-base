"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { useTheme } from "next-themes";
import { type Locale } from "@/config/translations";

const FONT_FAMILIES = [
  { id: "sans", value: 'GeistSans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: "serif", value: 'Georgia, Cambria, "Times New Roman", serif' },
  { id: "mono", value: 'GeistMono, "Fira Code", Courier, monospace' },
];

type Settings = {
  theme: string;
  locale: Locale;
  fontSize: number;
  fontFamily: string;
  dateFormat: string;
  timeFormat: string;
};

type SettingsContextType = {
  fontSize: number;
  fontFamily: string;
  dateFormat: string;
  timeFormat: string;
  updateSetting: (key: keyof Settings, value: string | number) => Promise<void>;
  isLoading: boolean;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, refreshSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, changeLocale } = useLanguage();
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("sans");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [isLoading, setIsLoading] = useState(true);

  // Apply settings to DOM
  const applyDOMSettings = (size: number, family: string) => {
    document.documentElement.style.setProperty("font-size", `${size}px`);
    const fontOption = FONT_FAMILIES.find((f) => f.id === family);
    if (fontOption) {
      document.documentElement.style.setProperty("--font-sans", fontOption.value);
      document.documentElement.style.setProperty("font-family", fontOption.value);
    }
  };

  // 1. Initial Load: Sync from User (DB) or LocalStorage
  useEffect(() => {
    const initSettings = () => {
      if (user) {
        // Logged in: Sync from DB User Settings
        if (user.theme && user.theme !== theme) {
          setTheme(user.theme);
        }
        if (user.locale && user.locale !== locale) {
          changeLocale(user.locale as Locale);
        }
        if (user.fontSize) {
          setFontSize(user.fontSize);
          localStorage.setItem("sys_font_size", String(user.fontSize));
        }
        if (user.fontFamily) {
          setFontFamily(user.fontFamily);
          localStorage.setItem("sys_font_family", user.fontFamily);
        }
        if (user.dateFormat) {
          setDateFormat(user.dateFormat);
          localStorage.setItem("sys_date_format", user.dateFormat);
        }
        if (user.timeFormat) {
          setTimeFormat(user.timeFormat);
          localStorage.setItem("sys_time_format", user.timeFormat);
        }
        applyDOMSettings(user.fontSize || 14, user.fontFamily || "sans");
      } else {
        // Not logged in: Fallback to LocalStorage
        const savedFontSize = localStorage.getItem("sys_font_size");
        const savedFontFamily = localStorage.getItem("sys_font_family");
        const savedDateFormat = localStorage.getItem("sys_date_format");
        const savedTimeFormat = localStorage.getItem("sys_time_format");

        if (savedFontSize) {
          setFontSize(Number(savedFontSize));
        }
        if (savedFontFamily) {
          setFontFamily(savedFontFamily);
        }
        if (savedDateFormat) {
          setDateFormat(savedDateFormat);
        }
        if (savedTimeFormat) {
          setTimeFormat(savedTimeFormat);
        }
        applyDOMSettings(Number(savedFontSize || 14), savedFontFamily || "sans");
      }
      setIsLoading(false);
    };

    const timer = setTimeout(initSettings, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 2. Update Settings (Local + DB)
  const updateSetting = async (key: keyof Settings, value: string | number) => {
    if (key === "theme") {
      setTheme(value as string);
    } else if (key === "locale") {
      changeLocale(value as Locale);
    } else if (key === "fontSize") {
      setFontSize(Number(value));
      localStorage.setItem("sys_font_size", String(value));
      applyDOMSettings(Number(value), fontFamily);
    } else if (key === "fontFamily") {
      setFontFamily(value as string);
      localStorage.setItem("sys_font_family", value as string);
      applyDOMSettings(fontSize, value as string);
    } else if (key === "dateFormat") {
      setDateFormat(value as string);
      localStorage.setItem("sys_date_format", value as string);
    } else if (key === "timeFormat") {
      setTimeFormat(value as string);
      localStorage.setItem("sys_time_format", value as string);
    }

    if (user) {
      try {
        await fetch("/api/auth/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });
        await refreshSession();
      } catch (err) {
        console.error("Failed to sync settings with DB:", err);
      }
    }
  };

  return (
    <SettingsContext.Provider value={{ fontSize, fontFamily, dateFormat, timeFormat, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
