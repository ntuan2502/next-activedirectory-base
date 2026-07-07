"use client";

import { useLanguage } from "@/components/language-provider";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RowsPerPageProps {
  value: number;
  onChange: (limit: number) => void;
  options?: number[];
  className?: string;
  wrapperClassName?: string;
}

export function RowsPerPage({
  value,
  onChange,
  options = [10, 20, 50, 100],
  className,
  wrapperClassName,
}: RowsPerPageProps) {
  const { t } = useLanguage();

  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={cn(
          "w-[150px] h-10 pl-3 pr-8 rounded-md border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground text-sm",
          className
        )}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-card text-foreground">
            {t("auditLogsPage.rowsPerPage", { count: opt })}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
    </div>
  );
}
