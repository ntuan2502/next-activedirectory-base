"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

type SessionUser = {
  userId: string;
  username: string;
  permissions?: string[];
};

type AuthContextType = {
  user: SessionUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_PATHS = ["/login"];

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const data: { user: SessionUser } = await res.json();
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const lastPathRef = useRef(pathname);

  const refreshSession = async () => {
    const sessionUser = await fetchSession();
    setUser(sessionUser);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  };

  useEffect(() => {
    // Only re-run when pathname actually changes
    if (status === "ready" && lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    let cancelled = false;

    const init = async () => {
      const sessionUser = await fetchSession();
      if (cancelled) return;

      const isPublicPath = PUBLIC_PATHS.includes(pathname);

      if (sessionUser && isPublicPath) {
        router.replace("/");
        return;
      }

      if (!sessionUser && !isPublicPath) {
        router.replace("/login");
        return;
      }

      setUser(sessionUser);
      setStatus("ready");
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: false, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
