"use client";

import React from "react";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className }: LoadingSpinnerProps) {
  const { t } = useLanguage();

  return (
    <div className={cn("bg-background/90 p-4 rounded-xl shadow-lg border border-muted/80 flex flex-col items-center gap-2 w-fit", className)}>
      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      <span className="text-xs font-medium text-muted-foreground">{t("common.loading")}</span>
    </div>
  );
}

interface LoadingOverlayProps {
  show: boolean;
  /**
   * "table": overlay offset top-10 to not hide the table header (the style used in users/roles/audit-logs).
   * "card": overlay inset-0, absolute (covers the parent element).
   * "full": fixed overlay covering the entire viewport, higher z-index.
   */
  variant?: "table" | "card" | "full";
  className?: string;
}

export function LoadingOverlay({ show, variant = "card", className }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "bg-background/40 backdrop-blur-[0.5px] z-20 flex items-center justify-center pointer-events-auto animate-in fade-in duration-200",
        variant === "table" && "absolute top-10 inset-x-0 bottom-0",
        variant === "card" && "absolute inset-0",
        variant === "full" && "fixed inset-0 z-50 bg-background/60 backdrop-blur-[1px]",
        className
      )}
    >
      <LoadingSpinner />
    </div>
  );
}
