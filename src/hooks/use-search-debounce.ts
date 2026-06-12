import { useEffect, Dispatch, SetStateAction } from "react";

interface UseSearchDebounceProps {
  localSearch: string;
  isReady: boolean;
  setSearch: Dispatch<SetStateAction<string>> | ((val: string) => void);
  setPage: Dispatch<SetStateAction<number>> | ((page: number) => void);
  delay?: number;
}

export function useSearchDebounce({
  localSearch,
  isReady,
  setSearch,
  setPage,
  delay = 1000,
}: UseSearchDebounceProps) {
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1); // Reset page to 1 when search query changes
    }, delay);
    return () => clearTimeout(timer);
  }, [localSearch, isReady, setSearch, setPage, delay]);
}
