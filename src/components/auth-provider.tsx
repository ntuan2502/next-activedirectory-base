"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LoadingOverlay } from "@/components/loading-overlay";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { translations, type Locale } from "@/config/translations";

type SessionUser = {
  userId: string;
  username: string;
  sessionId?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  isLocal?: boolean;
  createdAt?: string | null;
  roles?: { name: string; description: string | null }[];
  permissions?: string[];
  theme?: string;
  locale?: string;
  fontSize?: number;
  fontFamily?: string;
  dateFormat?: string;
  timeFormat?: string;
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
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [isKicked, setIsKicked] = useState(false);
  const [kickReason, setKickReason] = useState("");
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
      // 1. Fetch setup status first
      let isSetup = true;
      try {
        const setupRes = await fetch("/api/setup/status");
        if (setupRes.ok) {
          const setupData = await setupRes.json();
          isSetup = !!setupData.isSetup;
        }
      } catch (err) {
        console.error(err);
      }

      if (cancelled) return;

      // 2. If not setup, force redirection to /setup (unless already on /setup)
      if (!isSetup) {
        if (pathname !== "/setup") {
          router.replace("/setup");
          return;
        }
        setUser(null);
        setStatus("ready");
        return;
      }

      // 3. If already setup, block access to /setup
      if (isSetup && pathname === "/setup") {
        const sessionUser = await fetchSession();
        if (cancelled) return;
        router.replace(sessionUser ? "/" : "/login");
        return;
      }

      // 4. Standard session checks
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

  useEffect(() => {
    if (!user) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanup = false;

    const connect = () => {
      if (isCleanup) return;

      eventSource = new EventSource("/api/auth/sse");

      eventSource.addEventListener("connected", (event) => {
        try {
          console.log(t("sse.connectedLog"), JSON.parse(event.data));
        } catch {
          console.log(t("sse.connectedLog"));
        }
      });

      eventSource.addEventListener("SETTINGS_UPDATED", (event) => {
        try {
          const data = JSON.parse(event.data);
          const { sessionId, payload } = data;
          const isCurrentSession = sessionId === user.sessionId;

          setUser((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              ...payload,
            };
          });

          if (!isCurrentSession) {
            const newLocale = (payload.locale || user.locale || locale) as string;
            const sseTranslations = (translations[newLocale as Locale]?.sse || translations[locale]?.sse) as Record<string, string> | undefined;
            const message = sseTranslations?.settingsSynced || t("sse.settingsSynced");
            toast.success(message);
          }
        } catch (err) {
          console.error(t("sse.failedToParseSettings"), err);
        }
      });

      eventSource.addEventListener("PERMISSIONS_UPDATED", async () => {
        toast.info(t("sse.permissionsUpdated"));
        await refreshSession();
      });

      eventSource.addEventListener("AUDIT_LOG_CREATED", (event) => {
        try {
          const data = JSON.parse(event.data);
          window.dispatchEvent(new CustomEvent("audit_log_created_event", { detail: data.payload }));
        } catch (err) {
          console.error("Failed to parse audit log creation event", err);
        }
      });

      eventSource.addEventListener("SESSION_REVOKED", (event) => {
        try {
          const data = JSON.parse(event.data);
          const { sessionId, payload } = data;

          if (sessionId === user.sessionId || (payload?.exclude && payload.exclude !== user.sessionId)) {
            setKickReason(t("sse.sessionRevoked"));
            setIsKicked(true);
            fetch("/api/auth/logout", { method: "POST" });
          } else {
            // Dispatch window event so components like AccountPage can refresh active sessions list
            window.dispatchEvent(new CustomEvent("session_revoked_event"));
          }
        } catch (err) {
          console.error(t("sse.failedToParseSession"), err);
        }
      });

      eventSource.addEventListener("FORCE_LOGOUT", () => {
        setKickReason(t("sse.forceLogout"));
        setIsKicked(true);
        fetch("/api/auth/logout", { method: "POST" });
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
        }
        if (!isCleanup) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isCleanup = true;
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [user, t, locale]);

  if (isKicked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-card border border-destructive/20 rounded-xl shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-destructive">
              {t("sse.sessionTerminatedTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {kickReason || t("sse.sessionRevoked")}
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              setIsKicked(false);
            }}
            className="w-full py-2 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-medium transition-all shadow-md active:scale-95 cursor-pointer"
          >
            {t("sse.btnReLogin")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading" || (!user && !PUBLIC_PATHS.includes(pathname) && pathname !== "/setup")) {
    return <LoadingOverlay show={true} variant="full" />;
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
