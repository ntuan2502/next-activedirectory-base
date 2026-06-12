"use client";

import { useTheme } from "next-themes";
import { useSettings } from "@/components/settings-provider";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme } = useTheme();
  const { updateSetting } = useSettings();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => updateSetting("theme", theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
