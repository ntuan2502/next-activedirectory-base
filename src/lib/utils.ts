import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxVisible = 5;
  
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    
    if (start > 2) {
      pages.push("ellipsis-1");
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    if (end < totalPages - 1) {
      pages.push("ellipsis-2");
    }
    
    pages.push(totalPages);
  }
  return pages;
}

export function parseUserAgent(ua: string | null) {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS", isMobile: false };

  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let isMobile = false;

  // Detect OS
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) {
    if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) {
      os = "iOS";
      isMobile = true;
    } else {
      os = "macOS";
    }
  } else if (ua.includes("Android")) {
    os = "Android";
    isMobile = true;
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
    isMobile = true;
  }

  // Detect Browser
  if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Google Chrome";
  else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
  else if (ua.includes("Opera") || ua.includes("OPR/")) browser = "Opera";

  return { browser, os, isMobile };
}

export function formatRelativeTime(date: Date | string | number, locale: "en" | "vi" = "vi"): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const elapsedMs = d.getTime() - now.getTime();
  const elapsedSec = Math.round(elapsedMs / 1000);

  // Define time intervals in seconds
  const units: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
    { unit: "year", ms: 31536000 },
    { unit: "month", ms: 2628000 },
    { unit: "day", ms: 86400 },
    { unit: "hour", ms: 3600 },
    { unit: "minute", ms: 60 },
    { unit: "second", ms: 1 }
  ];

  const rtf = new Intl.RelativeTimeFormat(locale === "vi" ? "vi" : "en", { numeric: "always" });

  // If less than 10 seconds ago/from now, show "just now" / "vừa xong"
  if (Math.abs(elapsedSec) < 10) {
    return locale === "vi" ? "vừa xong" : "just now";
  }

  for (const { unit, ms } of units) {
    if (Math.abs(elapsedSec) >= ms || unit === "second") {
      const value = Math.round(elapsedSec / ms);
      return rtf.format(value, unit);
    }
  }

  return "";
}

export function formatDateTimeCustom(
  date: Date | string | number,
  dateFormat: string = "YYYY-MM-DD",
  timeFormat: string = "24h",
  locale: "en" | "vi" = "vi"
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const monthNum = d.getMonth() + 1;
  const dateNum = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");

  // Format Date Part
  let dateStr = "";
  if (dateFormat === "DD/MM/YYYY") {
    dateStr = `${pad(dateNum)}/${pad(monthNum)}/${year}`;
  } else if (dateFormat === "MM/DD/YYYY") {
    dateStr = `${pad(monthNum)}/${pad(dateNum)}/${year}`;
  } else if (dateFormat === "medium") {
    dateStr = d.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } else {
    // YYYY-MM-DD
    dateStr = `${year}-${pad(monthNum)}-${pad(dateNum)}`;
  }

  // Format Time Part
  let timeStr = "";
  if (timeFormat === "12h") {
    const period = hours >= 12 ? (locale === "vi" ? "CH" : "PM") : (locale === "vi" ? "SA" : "AM");
    const hour12 = hours % 12 || 12;
    timeStr = `${pad(hour12)}:${pad(minutes)}:${pad(seconds)} ${period}`;
  } else {
    // 24h
    timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${dateStr} ${timeStr}`;
}

