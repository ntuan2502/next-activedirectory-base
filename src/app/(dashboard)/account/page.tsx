"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { useTheme } from "next-themes";
import Swal from "sweetalert2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Lock,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Globe,
  Sliders,
  AlertCircle,
  KeyRound,
  ShieldAlert,
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

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { locale, t, changeLocale } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState<string>("sans");

  // Sync component mount to avoid hydration warnings with next-themes and load settings
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);

      const savedFontSize = localStorage.getItem("sys_font_size");
      if (savedFontSize) {
        setFontSize(Number(savedFontSize));
      }

      const savedFontFamily = localStorage.getItem("sys_font_family");
      if (savedFontFamily) {
        setFontFamily(savedFontFamily);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Synchronize font settings with DOM root styles safely in an effect
  useEffect(() => {
    if (!mounted) return;

    // Apply font size using setProperty to avoid styling immutability issues
    document.documentElement.style.setProperty("font-size", `${fontSize}px`);
    localStorage.setItem("sys_font_size", String(fontSize));

    // Apply font family variables
    const fontOption = FONT_FAMILIES.find((f) => f.id === fontFamily);
    if (fontOption) {
      document.documentElement.style.setProperty("--font-sans", fontOption.value);
      document.documentElement.style.setProperty("font-family", fontOption.value);
      localStorage.setItem("sys_font_family", fontFamily);
    }
  }, [fontSize, fontFamily, mounted]);

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
  };

  const handleFontFamilyChange = (id: string) => {
    setFontFamily(id);
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

  const memberSinceDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const handleSignOutOtherSessions = () => {
    Swal.fire({
      title: t("accountPage.signOutOtherSessions"),
      text: t("accountPage.signOutOtherSessionsDesc"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: t("common.confirm"),
      cancelButtonText: t("common.cancel"),
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: t("accountPage.signOutOtherSuccessTitle"),
          text: t("accountPage.signOutOtherSuccessText"),
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    });
  };

  const handleLogout = () => {
    logout();
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          {t("accountPage.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("accountPage.subtitle")}
        </p>
      </div>

      {/* Main Grid Layout: Asymmetric Column Tension (7/5 split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Profiles & Passwords */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* PROFILE SETTINGS CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
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
                    <Badge variant="secondary" className="flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider py-0.5 rounded-md">
                      <ShieldCheck className="h-3 w-3" />
                      {t("accountPage.syncedFromAD")}
                    </Badge>
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

            <CardContent className="p-6 space-y-6">
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
                      className="pl-10 bg-muted/40 font-mono text-muted-foreground border-border cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("accountPage.displayName")}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      type="text"
                      value={user?.displayName || ""}
                      disabled
                      className="pl-10 bg-muted/40 text-muted-foreground border-border cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("accountPage.email")}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="pl-10 bg-muted/40 text-muted-foreground border-border cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* Lock Warning Notice */}
              <div className="flex gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>{t("accountPage.profileLockedNotice")}</div>
              </div>
            </CardContent>
          </Card>

          {/* PASSWORD CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 p-6">
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
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Current Password */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t("accountPage.currentPassword")}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
                    <Input
                      type="password"
                      value="••••••••••••"
                      disabled
                      className="pl-10 bg-muted/40 text-muted-foreground border-border cursor-not-allowed select-none"
                    />
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
                      type="password"
                      value="••••••••••••"
                      disabled
                      className="pl-10 bg-muted/40 text-muted-foreground border-border cursor-not-allowed select-none"
                    />
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
                      type="password"
                      value="••••••••••••"
                      disabled
                      className="pl-10 bg-muted/40 text-muted-foreground border-border cursor-not-allowed select-none"
                    />
                  </div>
                </div>
              </div>

              {/* Password Lock Notice */}
              <div className="flex gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>{t("accountPage.passwordLockedNotice")}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Preferences, Roles, Danger Zone */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* DISPLAY PREFERENCES CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 p-6">
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
            <CardContent className="p-6 space-y-6">
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      theme === "light"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      theme === "dark"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Language Settings */}
              <div className="space-y-3 border-t pt-5">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    {t("accountPage.language")}
                  </Label>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block">
                    {t("accountPage.languageSubtitle")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => changeLocale("en")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      locale === "en"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span>English</span>
                  </button>
                  <button
                    onClick={() => changeLocale("vi")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                      locale === "vi"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    <span>Tiếng Việt</span>
                  </button>
                </div>
              </div>

              {/* Font Family Settings */}
              <div className="space-y-3 border-t pt-5">
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
                      onClick={() => handleFontFamilyChange(font.id)}
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
              <div className="space-y-3 border-t pt-5">
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
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
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
            </CardContent>
          </Card>

          {/* ROLES & PERMISSIONS CARD */}
          <Card className="border border-border bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-muted/5 p-6">
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
            <CardContent className="p-6 space-y-6">
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
              <div className="space-y-3 border-t pt-5">
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

          {/* DANGER ZONE CARD */}
          <Card className="border border-destructive/20 bg-card shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="border-b bg-destructive/5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  <LogOut className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-destructive">
                    {t("accountPage.dangerZone")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("accountPage.dangerZoneSubtitle")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Sign out other sessions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {t("accountPage.signOutOtherSessions")}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm leading-normal">
                    {t("accountPage.signOutOtherSessionsDesc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSignOutOtherSessions}
                  className="sm:w-auto shrink-0 border-border hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-all text-xs font-semibold cursor-pointer py-1.5 h-auto rounded-lg"
                >
                  {t("accountPage.signOutOtherSessionsButton")}
                </Button>
              </div>

              {/* Log out current device */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t pt-5">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    {t("accountPage.logoutDevice")}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm leading-normal">
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
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}
