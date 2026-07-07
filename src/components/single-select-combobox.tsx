"use client";

import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

interface Option {
  id: string;
  label: string;
  code?: string;
}

interface SingleSelectComboboxProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string; // e.g. "-- None --" or "-- Không chọn --"
}

function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function SingleSelectCombobox({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  emptyLabel,
}: SingleSelectComboboxProps) {
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

  const handleSelectOption = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
  };

  // Search logic: matches label or code, accent-insensitive
  const normalizedSearch = removeAccents(searchTerm.toLowerCase().trim());
  const filteredOptions = options.filter((opt) => {
    const labelMatch = removeAccents(opt.label.toLowerCase()).includes(normalizedSearch);
    const codeMatch = opt.code ? removeAccents(opt.code.toLowerCase()).includes(normalizedSearch) : false;
    return labelMatch || codeMatch;
  });

  const selectedOption = options.find((opt) => opt.id === value);
  const displayPlaceholder = placeholder || t("common.select") || "Select option...";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{ height: 40 }}
        className={cn(
          "flex w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors cursor-pointer select-none",
          disabled && "cursor-not-allowed opacity-50 bg-muted/30"
        )}
      >
        <span className={cn("truncate flex-1 pr-2", !selectedOption && "text-muted-foreground")}>
          {selectedOption ? selectedOption.label : displayPlaceholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full outline-none hover:bg-zinc-200 dark:hover:bg-zinc-800 p-0.5 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/60" />
        </div>
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

          {/* Options List */}
          <div className="overflow-y-auto max-h-56 p-1 space-y-0.5">
            {/* Special empty selection item if emptyLabel is provided */}
            {emptyLabel && !searchTerm && (
              <div
                onClick={() => handleSelectOption("")}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground select-none transition-colors italic text-muted-foreground",
                  value === "" && "bg-accent/40 font-semibold text-foreground"
                )}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === "" && <Check className="h-4 w-4 text-primary" />}
                </span>
                {emptyLabel}
              </div>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
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
              <div className="py-4 text-center text-sm text-muted-foreground italic select-none">
                {t("common.noResults") || "Không có kết quả"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
