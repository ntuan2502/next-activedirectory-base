"use client";

import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Search, X, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface Option {
  id: string;
  label: string;
  code?: string;
}

interface MultiSelectComboboxProps {
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function MultiSelectCombobox({
  options,
  selectedIds,
  onChange,
  placeholder,
  disabled = false,
}: MultiSelectComboboxProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opening popover
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleToggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleRemoveOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  // Search logic: matches label or code, accent-insensitive
  const normalizedSearch = removeAccents(searchTerm.toLowerCase().trim());
  const filteredOptions = options.filter((opt) => {
    const labelMatch = removeAccents(opt.label.toLowerCase()).includes(normalizedSearch);
    const codeMatch = opt.code ? removeAccents(opt.code.toLowerCase()).includes(normalizedSearch) : false;
    return labelMatch || codeMatch;
  });

  // Batch selections for filtered results
  const filteredIds = filteredOptions.map((opt) => opt.id);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const handleSelectAllFiltered = () => {
    const uniqueNewIds = Array.from(new Set([...selectedIds, ...filteredIds]));
    onChange(uniqueNewIds);
  };

  const handleDeselectAllFiltered = () => {
    onChange(selectedIds.filter((id) => !filteredIds.includes(id)));
  };

  const displayPlaceholder = placeholder || t("common.select") || "Select options...";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ minHeight: 40 }}
        className={cn(
          "flex w-full flex-wrap items-center justify-between rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer",
          disabled && "cursor-not-allowed opacity-50 bg-muted/30"
        )}
      >
        <div className="flex flex-wrap gap-1.5 py-0 max-w-[90%]">
          {selectedIds.length > 0 ? (
            options
              .filter((opt) => selectedIds.includes(opt.id))
              .map((opt) => (
                <Badge
                  key={opt.id}
                  variant="secondary"
                  className="flex items-center gap-1 font-semibold pl-2 pr-1 py-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200"
                >
                  {opt.label}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveOption(opt.id, e)}
                      className="rounded-full outline-none hover:bg-zinc-300 dark:hover:bg-zinc-700 p-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </Badge>
              ))
          ) : (
            <span className="text-muted-foreground">{displayPlaceholder}</span>
          )}
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground/60 ml-2" />
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none flex flex-col animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="flex items-center border-b px-3 py-2 bg-muted/10 gap-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              placeholder={t("common.search") + "..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="hover:bg-muted p-1 rounded-sm cursor-pointer"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Quick Action & Summary Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-xs bg-muted/5 text-muted-foreground">
            <span>
              {searchTerm
                ? `${t("common.matching") || "Khớp"}: ${filteredOptions.length}/${options.length}`
                : `${t("common.selected") || "Đã chọn"}: ${selectedIds.length}/${options.length}`}
            </span>
            {filteredOptions.length > 0 && (
              <div className="flex gap-2">
                {!allFilteredSelected ? (
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="flex items-center gap-1 text-primary hover:underline font-semibold cursor-pointer"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    {t("common.selectAll") || "Chọn tất cả"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeselectAllFiltered}
                    className="flex items-center gap-1 text-destructive hover:underline font-semibold cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5" />
                    {t("common.deselectAll") || "Bỏ chọn tất cả"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-56 p-1 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleToggleOption(opt.id)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground select-none transition-colors",
                      isSelected && "bg-accent/40 font-semibold"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </span>
                    {opt.label}
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground italic">
                {t("common.noResults") || "Không có kết quả"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
