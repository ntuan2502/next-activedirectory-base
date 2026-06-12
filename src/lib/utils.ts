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
