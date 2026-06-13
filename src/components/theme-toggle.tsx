"use client";
 
import { useTheme } from "next-themes";
import { useSettings } from "@/components/settings-provider";
import { useLanguage } from "@/components/language-provider";
import { Sun, Moon, Laptop, ChevronDown } from "lucide-react";
 
interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}
 
export function ThemeToggle({ className = "", size = "sm" }: ThemeToggleProps) {
  const { theme } = useTheme();
  const { updateSetting } = useSettings();
  const { t } = useLanguage();
 
  const isMd = size === "md";
 
  const getIcon = () => {
    const iconClass = `absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none ${
      isMd ? "h-4 w-4" : "h-3.5 w-3.5"
    }`;
    if (theme === "dark") {
      return <Moon className={iconClass} />;
    }
    if (theme === "system") {
      return <Laptop className={iconClass} />;
    }
    return <Sun className={iconClass} />;
  };
 
  return (
    <div className={`relative ${className}`}>
      {getIcon()}
      <select
        value={theme || "system"}
        onChange={(e) => updateSetting("theme", e.target.value)}
        className={`w-full pl-9 pr-8 rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground ${
          isMd ? "py-2.5 text-sm" : "py-1.5 text-xs"
        }`}
      >
        <option value="light" className="bg-card text-foreground">
          {t("common.light")}
        </option>
        <option value="dark" className="bg-card text-foreground">
          {t("common.dark")}
        </option>
        <option value="system" className="bg-card text-foreground">
          {t("common.system")}
        </option>
      </select>
      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none ${isMd ? "h-4 w-4" : "h-3.5 w-3.5"}`} />
    </div>
  );
}
