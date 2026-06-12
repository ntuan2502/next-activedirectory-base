"use client";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { locale, changeLocale } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex items-center gap-2 h-8 px-2 justify-start text-muted-foreground hover:text-foreground font-medium text-xs w-full"
      onClick={() => changeLocale(locale === "en" ? "vi" : "en")}
      title={locale === "en" ? "Switch to Vietnamese" : "Chuyển sang tiếng Anh"}
    >
      <Globe className="h-4 w-4 text-primary" />
      <span className="flex-1 text-left">
        {locale === "en" ? "English (EN)" : "Tiếng Việt (VI)"}
      </span>
      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold">
        {locale === "en" ? "vi" : "en"}
      </span>
    </Button>
  );
}
