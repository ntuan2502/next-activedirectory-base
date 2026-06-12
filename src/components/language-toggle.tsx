"use client";

import { useLanguage } from "@/components/language-provider";
import { useSettings } from "@/components/settings-provider";
import { Globe, ChevronDown } from "lucide-react";

interface LanguageToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export function LanguageToggle({ className = "", size = "sm" }: LanguageToggleProps) {
  const { locale } = useLanguage();
  const { updateSetting } = useSettings();

  const isMd = size === "md";

  return (
    <div className={`relative w-full ${className}`}>
      <Globe className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none ${isMd ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
      <select
        value={locale}
        onChange={(e) => updateSetting("locale", e.target.value as "en" | "vi")}
        className={`w-full pl-9 pr-8 rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground ${
          isMd ? "py-2.5 text-sm" : "py-1.5 text-xs"
        }`}
      >
        <option value="en" className="bg-card text-foreground">English</option>
        <option value="vi" className="bg-card text-foreground">Tiếng Việt</option>
      </select>
      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none ${isMd ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
    </div>
  );
}
