"use client";

import { useState, useEffect } from "react";

interface TopProgressBarProps {
  isLoading: boolean;
}

export function TopProgressBar({ isLoading }: TopProgressBarProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    let initTimeout: NodeJS.Timeout;
    let endTimeout: NodeJS.Timeout;

    if (isLoading) {
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
    } else {
      endTimeout = setTimeout(() => {
        setLoadingProgress(100);
      }, 0);

      timeout = setTimeout(() => {
        setShowProgress(false);
        setLoadingProgress(0);
      }, 250);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (initTimeout) clearTimeout(initTimeout);
      if (endTimeout) clearTimeout(endTimeout);
    };
  }, [isLoading]);

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
