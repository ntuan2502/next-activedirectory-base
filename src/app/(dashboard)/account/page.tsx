"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "next-themes";
import { useSettings } from "@/components/settings-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { SUPPORTED_LOCALES } from "@/config/translations";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { parseUserAgent, formatDateTimeCustom } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import {
  User,
  Lock,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Sliders,
  AlertCircle,
  KeyRound,
  ShieldAlert,
  Laptop,
  Smartphone,
  Trash2,
  RefreshCw,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";

interface UserAvatarProps {
  avatarUrl?: string;
  displayName?: string;
  username: string;
}

function UserAvatar({ avatarUrl, displayName, username }: UserAvatarProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [prevUrl, setPrevUrl] = useState<string | undefined>(undefined);

  if (avatarUrl !== prevUrl) {
    setPrevUrl(avatarUrl);
    setAvatarError(false);
  }

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  if (!avatarError && avatarUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={avatarUrl}
        alt={displayName || username}
        onError={() => setAvatarError(true)}
        className="h-20 w-20 rounded-2xl object-cover border-2 border-primary/20 shadow-md transition-transform duration-300 hover:scale-105"
      />
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-bold border-2 border-primary/20 shadow-md transition-transform duration-300 hover:scale-105">
      {initials}
    </div>
  );
}

const FONT_FAMILIES = [
  { id: "sans", nameKey: "accountPage.fontFamilyOptions.sans", value: 'GeistSans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: "serif", nameKey: "accountPage.fontFamilyOptions.serif", value: 'Georgia, Cambria, "Times New Roman", serif' },
  { id: "mono", nameKey: "accountPage.fontFamilyOptions.mono", value: 'GeistMono, "Fira Code", Courier, monospace' },
];

type ActiveSession = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

type DateTimePreviewProps = {
  dateFormat: string;
  timeFormat: string;
  locale: string;
};

function DateTimePreview({ dateFormat, timeFormat, locale }: DateTimePreviewProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-sm font-mono font-semibold text-primary transition-all duration-200">
      {formatDateTimeCustom(now, dateFormat, timeFormat, locale)}
    </span>
  );
}

export default function AccountPage() {
  const { user, logout, refreshSession } = useAuth();
  const { locale, t } = useLanguage();
  const { theme } = useTheme();
  const { fontSize, fontFamily, dateFormat, timeFormat, updateSetting } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Local user profile state
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  // Local user password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // Mật khẩu show/hide state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isLocal = !!user?.isLocal;

  const isProfileChanged =
    profileDisplayName.trim() !== (user?.displayName || "") ||
    profileEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase();

  const isPasswordFilled =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmNewPassword.length > 0;

  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: React.ReactNode;
    actionText: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  } | null>(null);

  const confirmAction = (config: typeof confirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };

  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setProfileDisplayName(user.displayName || "");
        setProfileEmail(user.email || "");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileDisplayName.trim() || !profileEmail.trim()) {
      toast.error(t("setupPage.errorRequiredFields"));
      return;
    }

    setIsProfileSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "profile",
          displayName: profileDisplayName,
          email: profileEmail,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("accountPage.profileUpdated"));
        await refreshSession();
      } else {
        toast.error(data.error || t("common.failedToSave"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error(t("setupPage.errorRequiredFields"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error(t("setupPage.errorPasswordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("accountPage.passwordMinLength"));
      return;
    }

    setIsPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "password",
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("accountPage.passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        toast.error(data.error || t("common.failedToSave"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      fetchSessions();
    }, 0);

    const handleSessionRevoked = () => {
      fetchSessions();
    };

    window.addEventListener("session_revoked_event", handleSessionRevoked);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("session_revoked_event", handleSessionRevoked);
    };
  }, []);

  const handleRevokeSession = async (id: string) => {
    confirmAction({
      title: t("common.confirm"),
      description: t("accountPage.revokeSessionConfirm"),
      actionText: t("common.confirm"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/auth/sessions?id=${id}`, { method: "DELETE" });
          if (res.ok) {
            const data = await res.json();
            if (data.loggedOutCurrent) {
              logout();
            } else {
              toast.success(t("accountPage.signOutOtherSuccessText"));
              fetchSessions();
            }
          } else {
            toast.error(t("common.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const handleRevokeOtherSessions = async () => {
    confirmAction({
      title: t("accountPage.signOutOtherSessions"),
      description: t("accountPage.signOutOtherSessionsDesc"),
      actionText: t("accountPage.signOutOtherSessionsButton"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/auth/sessions?action=other", { method: "DELETE" });
          if (res.ok) {
            toast.success(t("accountPage.signOutOtherSuccessText"));
            fetchSessions();
          } else {
            toast.error(t("common.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const handleRevokeAllSessions = async () => {
    confirmAction({
      title: t("accountPage.signOutAllSessions"),
      description: t("accountPage.signOutAllSessionsDesc"),
      actionText: t("accountPage.signOutAllSessionsButton"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/auth/sessions?action=all", { method: "DELETE" });
          if (res.ok) {
            logout();
          } else {
            toast.error(t("common.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const formatDateTime = (dateStr: string) => {
    return formatDateTimeCustom(dateStr, dateFormat, timeFormat, locale);
  };

  const getRoleName = (name: string) => {
    const key = name.toLowerCase().replace(/\s+/g, "");
    const translated = t(`rolesPage.names.${key}`);
    return translated !== `rolesPage.names.${key}` ? translated : name;
  };

  const getRoleDescription = (name: string, description: string | null) => {
    const key = name.toLowerCase().replace(/\s+/g, "");
    const translated = t(`rolesPage.descriptions.${key}`);
    return translated !== `rolesPage.descriptions.${key}` ? translated : (description || "");
  };

  const getPermissionName = (perm: string) => {
    const translated = t(`permissions.names.${perm}`);
    return translated !== `permissions.names.${perm}` ? translated : perm;
  };

  const localeConfig = SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];
  const memberSinceDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(localeConfig.localeStr, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const handleLogout = () => {
    logout();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <User className="w-8 h-8 text-primary" />
            {t("accountPage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("accountPage.subtitle")}
          </p>
        </div>
      </div>

      {/* Main Grid Layout: Asymmetric Column Tension (7/5 split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Profiles & Passwords */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* PROFILE SETTINGS CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 pb-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <UserAvatar
                  avatarUrl={user?.avatarUrl}
                  displayName={user?.displayName}
                  username={user?.username || ""}
                />
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-2xl font-bold text-foreground tracking-tight">
                      {user?.displayName || user?.username}
                    </span>
                    {isLocal ? (
                      <Badge variant="secondary" className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider py-0.5 rounded-md">
                        <User className="h-3 w-3" />
                        {t("accountPage.localAccount")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider py-0.5 rounded-md">
                        <ShieldCheck className="h-3 w-3" />
                        {t("accountPage.syncedFromAD")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="font-mono text-muted-foreground/80">@{user?.username}</div>
                    <div>
                      {t("accountPage.memberSince")}: <span className="font-semibold text-foreground">{memberSinceDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleSaveProfile} noValidate>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("loginPage.username")}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      <Input
                        type="text"
                        value={user?.username || ""}
                        disabled
                        className="pl-10 bg-muted/40 font-mono text-muted-foreground cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("accountPage.displayName")}
                    </Label>
                    <div className="relative">
                      {isLocal ? (
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      ) : (
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      )}
                      <Input
                        type="text"
                        value={isLocal ? profileDisplayName : (user?.displayName || "")}
                        onChange={(e) => isLocal && setProfileDisplayName(e.target.value)}
                        disabled={!isLocal}
                        className={isLocal ? "pl-10" : "pl-10 bg-muted/40 text-muted-foreground cursor-not-allowed select-none"}
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("accountPage.email")}
                    </Label>
                    <div className="relative">
                      {isLocal ? (
                        <Sliders className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      ) : (
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      )}
                      <Input
                        type="email"
                        value={isLocal ? profileEmail : (user?.email || "")}
                        onChange={(e) => isLocal && setProfileEmail(e.target.value)}
                        disabled={!isLocal}
                        className={isLocal ? "pl-10" : "pl-10 bg-muted/40 text-muted-foreground cursor-not-allowed select-none"}
                        required
                      />
                    </div>
                  </div>
                </div>

                {isLocal ? (
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isProfileSaving || !isProfileChanged || !profileDisplayName.trim() || !profileEmail.trim()} className="font-semibold h-9 px-5">
                      {isProfileSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      {t("accountPage.btnSave")}
                    </Button>
                  </div>
                ) : (
                  /* Lock Warning Notice */
                  <div className="flex gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>{t("accountPage.profileLockedNotice")}</div>
                  </div>
                )}
              </CardContent>
            </form>
          </Card>

          {/* PASSWORD CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    {t("accountPage.password")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("accountPage.passwordSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleUpdatePassword} noValidate>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Current Password */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("accountPage.currentPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      <Input
                        type={showCurrentPassword && isLocal ? "text" : "password"}
                        value={isLocal ? currentPassword : "••••••••••••"}
                        onChange={(e) => isLocal && setCurrentPassword(e.target.value)}
                        placeholder={isLocal ? t("accountPage.placeholderCurrentPassword") : "••••••••••••"}
                        disabled={!isLocal}
                        className={isLocal ? "pl-10 pr-10" : "pl-10 bg-muted/40 text-muted-foreground cursor-not-allowed select-none"}
                        required={isLocal}
                      />
                      {isLocal && (
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground focus:outline-none cursor-pointer"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("accountPage.newPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      <Input
                        type={showNewPassword && isLocal ? "text" : "password"}
                        value={isLocal ? newPassword : "••••••••••••"}
                        onChange={(e) => isLocal && setNewPassword(e.target.value)}
                        placeholder={isLocal ? t("accountPage.placeholderNewPassword") : "••••••••••••"}
                        disabled={!isLocal}
                        className={isLocal ? "pl-10 pr-10" : "pl-10 bg-muted/40 text-muted-foreground cursor-not-allowed select-none"}
                        required={isLocal}
                      />
                      {isLocal && (
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground focus:outline-none cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("accountPage.confirmNewPassword")}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                      <Input
                        type={showConfirmPassword && isLocal ? "text" : "password"}
                        value={isLocal ? confirmNewPassword : "••••••••••••"}
                        onChange={(e) => isLocal && setConfirmNewPassword(e.target.value)}
                        placeholder={isLocal ? t("accountPage.placeholderConfirmNewPassword") : "••••••••••••"}
                        disabled={!isLocal}
                        className={isLocal ? "pl-10 pr-10" : "pl-10 bg-muted/40 text-muted-foreground cursor-not-allowed select-none"}
                        required={isLocal}
                      />
                      {isLocal && (
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground focus:outline-none cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isLocal ? (
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isPasswordSaving || !isPasswordFilled} className="font-semibold h-9 px-5">
                      {isPasswordSaving && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      {t("accountPage.updatePassword")}
                    </Button>
                  </div>
                ) : (
                  /* Password Lock Notice */
                  <div className="flex gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>{t("accountPage.passwordLockedNotice")}</div>
                  </div>
                )}
              </CardContent>
            </form>
          </Card>

          {/* ROLES & PERMISSIONS CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    {t("accountPage.rolesAndAccess")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("accountPage.rolesAndAccessSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User Roles */}
              <div className="space-y-3">
                {user?.roles && user.roles.length > 0 ? (
                  <div className="space-y-2.5">
                    {user.roles.map((role) => (
                      <div key={role.name} className="flex flex-col gap-1 p-3.5 rounded-lg border bg-muted/25 relative overflow-hidden transition-colors hover:bg-muted/40">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            {getRoleName(role.name)}
                          </span>
                          {(role.name.toLowerCase() === "superadmin" || role.name.toLowerCase() === "administrator") && (
                            <span className="text-[9px] bg-primary/10 text-primary border border-primary/25 rounded px-1.5 py-0.5 font-extrabold uppercase tracking-wider">
                              {t("common.system")}
                            </span>
                          )}
                        </div>
                        {(role.description || getRoleDescription(role.name, role.description)) && (
                          <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                            {getRoleDescription(role.name, role.description)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    {t("rolesPage.noRolesAvailable")}
                  </p>
                )}
              </div>

              {/* User Permissions */}
              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  {t("accountPage.globalPermissions")}
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto p-3 bg-muted/15 rounded-lg border">
                  {user?.permissions && user.permissions.length > 0 ? (
                    user.permissions.includes("*") ? (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-bold font-mono">
                        <ShieldAlert className="h-4 w-4" />
                        <span>{t("accountPage.allPermissionsGranted")}</span>
                      </div>
                    ) : (
                      user.permissions.map((perm) => (
                        <Badge
                          key={perm}
                          variant="outline"
                          className="px-2 py-0.5 font-mono text-[10px] text-muted-foreground bg-card border-border hover:bg-muted/10 transition-all rounded-md"
                        >
                          {getPermissionName(perm)}
                        </Badge>
                      ))
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {t("accountPage.noPermissions")}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Preferences, Roles, Active Sessions, Danger Zone */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* DISPLAY PREFERENCES CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">
                    {t("accountPage.preferences")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("accountPage.preferencesSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Theme Settings */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {t("accountPage.theme")}
                  </Label>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {t("accountPage.themeSubtitle")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateSetting("theme", "light")}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      theme === "light"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    <span>{t("common.light")}</span>
                  </button>
                  <button
                    onClick={() => updateSetting("theme", "dark")}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      theme === "dark"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    <span>{t("common.dark")}</span>
                  </button>
                  <button
                    onClick={() => updateSetting("theme", "system")}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      theme === "system" || !theme
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Laptop className="h-4 w-4" />
                    <span>{t("common.system")}</span>
                  </button>
                </div>
              </div>

              {/* Language Settings */}
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {t("accountPage.language")}
                  </Label>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {t("accountPage.languageSubtitle")}
                  </span>
                </div>
                <LanguageToggle size="md" />
              </div>

              {/* Font Family Settings */}
              <div className="space-y-3 border-t pt-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {t("accountPage.fontFamily")}
                  </Label>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {t("accountPage.fontFamilySubtitle")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {FONT_FAMILIES.map((font) => (
                    <button
                      key={font.id}
                      onClick={() => updateSetting("fontFamily", font.id)}
                      style={{ fontFamily: font.value }}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        fontFamily === font.id
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm font-bold">Aa</span>
                      <span className="text-[10px] mt-1 font-sans truncate w-full text-center">
                        {t(font.nameKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Settings */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      {t("accountPage.fontSize")}
                    </Label>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {t("accountPage.fontSizeSubtitle")}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-muted px-2 py-0.5">
                    {fontSize}px
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <input
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={fontSize}
                    onChange={(e) => updateSetting("fontSize", Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  
                  {/* Real-time scaling typography preview */}
                  <div className="p-3 border rounded-lg bg-muted/15 min-h-[48px] flex items-center justify-center">
                    <p style={{ fontSize: `${fontSize}px` }} className="text-muted-foreground font-medium text-center transition-all duration-200">
                      {t("accountPage.fontSizePreview")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Date & Time Format Settings */}
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date Format */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      {t("accountPage.dateFormat")}
                    </Label>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {t("accountPage.dateFormatSubtitle")}
                    </span>
                    <div className="relative w-full">
                      <select
                        value={dateFormat}
                        onChange={(e) => updateSetting("dateFormat", e.target.value)}
                        className="w-full pl-3 pr-9 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground"
                      >
                        <option value="YYYY-MM-DD" className="bg-card text-foreground">{t("accountPage.dateFormatOptions.YYYY-MM-DD")}</option>
                        <option value="DD/MM/YYYY" className="bg-card text-foreground">{t("accountPage.dateFormatOptions.DD/MM/YYYY")}</option>
                        <option value="MM/DD/YYYY" className="bg-card text-foreground">{t("accountPage.dateFormatOptions.MM/DD/YYYY")}</option>
                        <option value="medium" className="bg-card text-foreground">{t("accountPage.dateFormatOptions.medium")}</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    </div>
                  </div>

                  {/* Time Format */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      {t("accountPage.timeFormat")}
                    </Label>
                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                      {t("accountPage.timeFormatSubtitle")}
                    </span>
                    <div className="relative w-full">
                      <select
                        value={timeFormat}
                        onChange={(e) => updateSetting("timeFormat", e.target.value)}
                        className="w-full pl-3 pr-9 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground"
                      >
                        <option value="24h" className="bg-card text-foreground">
                          {t("accountPage.timeFormatOptions.24h")}
                        </option>
                        <option value="12h" className="bg-card text-foreground">
                          {t("accountPage.timeFormatOptions.12h")}
                        </option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Date & Time Preview */}
                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {t("accountPage.dateTimePreview")}
                  </span>
                  <div className="p-3 border rounded-lg bg-muted/15 flex items-center justify-center min-h-[48px]">
                    <DateTimePreview dateFormat={dateFormat} timeFormat={timeFormat} locale={locale} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ACTIVE SESSIONS & SECURITY CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-foreground">
                      {t("accountPage.activeSessions")}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {t("accountPage.activeSessionsSubtitle")}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  className="h-8 w-8 rounded-lg cursor-pointer"
                  title="Refresh sessions"
                >
                  <RefreshCw className={`h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 relative min-h-[160px]">
              <LoadingOverlay show={sessionsLoading} variant="card" />
              {/* Sessions List */}
              <div className="space-y-4">
                {sessions.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {sessions.map((session) => {
                      const { browser, os, isMobile } = parseUserAgent(session.userAgent);
                      const Icon = isMobile ? Smartphone : Laptop;
                      return (
                        <div
                          key={session.id}
                          className="flex items-center justify-between gap-4 p-3.5 rounded-lg border bg-muted/25 relative overflow-hidden transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card border border-border">
                              <Icon className="h-5 w-5 text-muted-foreground/80" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground truncate">
                                  {browser} on {os}
                                </span>
                                {session.isCurrent && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold uppercase tracking-wider py-0.5 rounded px-1.5 shrink-0">
                                    {t("accountPage.currentDevice")}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate mt-0.5">
                                {session.ipAddress || t("accountPage.unknownIp")} • {formatDateTime(session.lastActiveAt)}
                              </span>
                              <span
                                className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[240px] sm:max-w-[320px] mt-1 select-all cursor-help"
                                title={session.userAgent || ""}
                              >
                                {session.userAgent || "-"}
                              </span>
                            </div>
                          </div>

                          {!session.isCurrent && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRevokeSession(session.id)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg shrink-0 cursor-pointer"
                              title="Sign out this device"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : !sessionsLoading ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    No active sessions found.
                  </p>
                ) : null}
              </div>

              {/* DANGER ZONE / SECURITY ACTIONS */}
              <div className="border-t border-destructive/20 bg-destructive/5 -mx-4 -mb-4 p-4 space-y-4">
                <div className="flex items-center gap-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {t("accountPage.dangerZone")}
                  </span>
                </div>

                {/* Sign out other sessions */}
                {!sessionsLoading && sessions.length > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-foreground">
                        {t("accountPage.signOutOtherSessions")}
                      </h4>
                      <p className="text-[10px] text-muted-foreground max-w-sm leading-normal">
                        {t("accountPage.signOutOtherSessionsDesc")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleRevokeOtherSessions}
                      className="sm:w-auto shrink-0 border-border hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all text-xs font-semibold cursor-pointer py-1.5 h-auto rounded-lg"
                    >
                      {t("accountPage.signOutOtherSessionsButton")}
                    </Button>
                  </div>
                )}

                {/* Sign out all sessions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-destructive/10 pt-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">
                      {t("accountPage.signOutAllSessions")}
                    </h4>
                    <p className="text-[10px] text-muted-foreground max-w-sm leading-normal">
                      {t("accountPage.signOutAllSessionsDesc")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRevokeAllSessions}
                    className="sm:w-auto shrink-0 border-border hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all text-xs font-semibold cursor-pointer py-1.5 h-auto rounded-lg"
                  >
                    {t("accountPage.signOutAllSessionsButton")}
                  </Button>
                </div>

                {/* Log out current device */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-destructive/10 pt-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-foreground">
                      {t("accountPage.logoutDevice")}
                    </h4>
                    <p className="text-[10px] text-muted-foreground max-w-sm leading-normal">
                      {t("accountPage.logoutDeviceDesc")}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    className="sm:w-auto shrink-0 text-xs font-bold transition-all cursor-pointer py-1.5 h-auto rounded-lg shadow-sm"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t("accountPage.logoutButton")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmOpen === false}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmOpen === false}
              onClick={() => {
                confirmConfig?.onConfirm();
                setConfirmOpen(false);
              }}
              variant={confirmConfig?.variant === "destructive" ? "destructive" : "default"}
            >
              {confirmConfig?.actionText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
