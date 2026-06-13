"use client";

import { useState, useEffect } from "react";

export function GlobalProgressBar() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    let activeRequests = 0;
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    let initTimeout: NodeJS.Timeout;
    let endTimeout: NodeJS.Timeout;
    let debounceTimeout: NodeJS.Timeout | null = null;

    const startLoading = () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (initTimeout) clearTimeout(initTimeout);
      if (endTimeout) clearTimeout(endTimeout);

      initTimeout = setTimeout(() => {
        setShowProgress(true);
        setLoadingProgress(10);
      }, 0);

      interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev < 40) return prev + 15;
          if (prev < 75) return prev + 5;
          if (prev < 90) return prev + 2;
          if (prev < 98) return prev + 0.3;
          return prev;
        });
      }, 100);
    };

    const stopLoading = () => {
      if (interval) clearInterval(interval);
      if (initTimeout) clearTimeout(initTimeout);
      
      endTimeout = setTimeout(() => {
        setLoadingProgress(100);
      }, 0);

      timeout = setTimeout(() => {
        setShowProgress(false);
        setLoadingProgress(0);
      }, 250);
    };

    // Monkey-patch window.fetch to capture all HTTP calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url || "";
      // Exclude background polling requests to prevent UI annoyance
      const isBackground = url.includes("/sync/status") || url.includes("/ldap/sync/status");

      if (!isBackground) {
        activeRequests++;
        if (activeRequests === 1) {
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
            debounceTimeout = null;
          } else {
            startLoading();
          }
        }
      }

      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        if (!isBackground) {
          activeRequests--;
          if (activeRequests === 0) {
            if (debounceTimeout) clearTimeout(debounceTimeout);
            
            debounceTimeout = setTimeout(() => {
              stopLoading();
              debounceTimeout = null;
            }, 180); // 180ms delay to bridge sequential requests seamlessly
          }
        }
      }
    };

    return () => {
      window.fetch = originalFetch; // Restore original fetch on unmount
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (initTimeout) clearTimeout(initTimeout);
      if (endTimeout) clearTimeout(endTimeout);
      if (debounceTimeout) clearTimeout(debounceTimeout);
    };
  }, []);

  if (!showProgress) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] bg-transparent z-[9999] pointer-events-none">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out shadow-[0_1px_8px_var(--primary)]"
        style={{ width: `${loadingProgress}%` }}
      />
    </div>
  );
}
