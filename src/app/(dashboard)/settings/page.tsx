"use client";

import { useState, useEffect, useCallback } from "react";
import { Server, Save, RefreshCw, Eye, EyeOff, Check, AlertCircle, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SettingsData = {
  ldapUrl: string;
  ldapPort: number;
  ldapBindDn: string;
  ldapBindPassword?: string;
  ldapBaseDn: string;
  ldapFilter: string;
  syncEnabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastSyncMessage: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [ldapUrl, setLdapUrl] = useState("");
  const [ldapPort, setLdapPort] = useState("389");
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapBaseDn, setLdapBaseDn] = useState("");
  const [ldapFilter, setLdapFilter] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(24);

  // Read-only system state (from last sync)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState("none");
  const [lastSyncMessage, setLastSyncMessage] = useState("");
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const d: SettingsData = result.data;
          setLdapUrl(d.ldapUrl);
          setLdapPort(String(d.ldapPort));
          setLdapBindDn(d.ldapBindDn);
          const hasConfig = !!d.ldapUrl;
          setHasExistingConfig(hasConfig);
          setLdapBindPassword(hasConfig ? "********" : "");
          setLdapBaseDn(d.ldapBaseDn);
          setLdapFilter(d.ldapFilter);
          setSyncEnabled(d.syncEnabled);
          setSyncInterval(d.syncInterval);
          setLastSyncAt(d.lastSyncAt);
          setLastSyncStatus(d.lastSyncStatus);
          setLastSyncMessage(d.lastSyncMessage);
        }
      } else {
        toast.error(t("settingsPage.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.LDAP_SYNC)) {
      Promise.resolve().then(() => loadSettings());
    }
  }, [user, loadSettings, hasPermission]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api/ldap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ldapUrl,
          ldapPort: parseInt(ldapPort, 10),
          ldapBindDn,
          ldapBindPassword,
          ldapBaseDn,
          ldapFilter,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("dashboard.successTest"));
      } else {
        toast.error(data.error || "Connection test failed");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("common.networkError");
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
      toast.error("Please fill in all required LDAP settings fields.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ldapUrl,
          ldapPort: parseInt(ldapPort, 10),
          ldapBindDn,
          ldapBindPassword,
          ldapBaseDn,
          ldapFilter,
          syncEnabled,
          syncInterval,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(t("settingsPage.saveSuccess"));
        setHasExistingConfig(true);
        setLdapBindPassword("********");
        // Update local sync status if changed
        if (result.data) {
          const d: SettingsData = result.data;
          setLastSyncAt(d.lastSyncAt);
          setLastSyncStatus(d.lastSyncStatus);
          setLastSyncMessage(d.lastSyncMessage);
        }
      } else {
        toast.error(result.error || t("settingsPage.saveFailed"));
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasPermission(PERMISSIONS.LDAP_SYNC)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle className="w-16 h-16 text-destructive animate-bounce" />
        <h2 className="text-2xl font-bold">{t("common.accessDenied")}</h2>
        <p className="text-muted-foreground max-w-md">{t("common.accessDeniedDesc")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Server className="w-8 h-8 text-primary" />
          {t("settingsPage.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("settingsPage.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LDAP Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                {t("settingsPage.ldapCard")}
              </CardTitle>
              <CardDescription>{t("settingsPage.ldapCardDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="ldapUrl" className="font-semibold">{t("settingsPage.ldapServerUrl")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="ldapUrl"
                    placeholder={t("settingsPage.placeholderUrl")}
                    value={ldapUrl}
                    onChange={(e) => setLdapUrl(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldapPort" className="font-semibold">{t("settingsPage.ldapPort")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="ldapPort"
                    type="number"
                    value={ldapPort}
                    onChange={(e) => setLdapPort(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ldapBindDn" className="font-semibold">{t("settingsPage.ldapBindDn")} <span className="text-destructive">*</span></Label>
                <Input
                  id="ldapBindDn"
                  placeholder={t("settingsPage.placeholderBindDn")}
                  value={ldapBindDn}
                  onChange={(e) => setLdapBindDn(e.target.value)}
                  required
                  className="focus-visible:ring-primary animate-fade-in"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ldapBindPassword" className="font-semibold">
                  {t("settingsPage.ldapBindPassword")}
                  {!hasExistingConfig && <span className="text-destructive"> *</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="ldapBindPassword"
                    type={showPassword ? "text" : "password"}
                    value={ldapBindPassword}
                    onChange={(e) => setLdapBindPassword(e.target.value)}
                    required={!hasExistingConfig}
                    placeholder={hasExistingConfig ? "******** (Để trống để giữ mật khẩu cũ)" : "Nhập mật khẩu kết nối LDAP"}
                    className="pr-10 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ldapBaseDn" className="font-semibold">{t("settingsPage.ldapBaseDn")} <span className="text-destructive">*</span></Label>
                <Input
                  id="ldapBaseDn"
                  placeholder={t("settingsPage.placeholderBaseDn")}
                  value={ldapBaseDn}
                  onChange={(e) => setLdapBaseDn(e.target.value)}
                  required
                  className="focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ldapFilter" className="font-semibold">{t("settingsPage.ldapFilter")}</Label>
                <Input
                  id="ldapFilter"
                  placeholder={t("settingsPage.placeholderFilter")}
                  value={ldapFilter}
                  onChange={(e) => setLdapFilter(e.target.value)}
                  className="focus-visible:ring-primary"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync scheduler and status */}
        <div className="space-y-6">
          {/* Scheduling Card */}
          <Card className="shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {t("settingsPage.syncCard")}
              </CardTitle>
              <CardDescription>{t("settingsPage.syncCardDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-lg border">
                <Checkbox
                  id="syncEnabled"
                  checked={syncEnabled}
                  onCheckedChange={(checked) => setSyncEnabled(!!checked)}
                  className="data-[state=checked]:bg-primary h-5 w-5"
                />
                <Label htmlFor="syncEnabled" className="text-sm font-semibold cursor-pointer">
                  {t("settingsPage.syncEnabled")}
                </Label>
              </div>

              <div className="space-y-3">
                <Label htmlFor="syncInterval" className="font-semibold">
                  {t("settingsPage.syncInterval")}
                </Label>
                <div className="flex items-center gap-3">
                  <select
                    id="syncInterval"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(parseInt(e.target.value, 10))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={1}>1 {t("settingsPage.hours")}</option>
                    <option value={6}>6 {t("settingsPage.hours")}</option>
                    <option value={12}>12 {t("settingsPage.hours")}</option>
                    <option value={24}>24 {t("settingsPage.hours")} (1 {t("common.system") === "Hệ thống" ? "ngày" : "day"})</option>
                    <option value={48}>48 {t("settingsPage.hours")} (2 {t("common.system") === "Hệ thống" ? "ngày" : "days"})</option>
                    <option value={168}>168 {t("settingsPage.hours")} (1 {t("common.system") === "Hệ thống" ? "tuần" : "week"})</option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("settingsPage.syncIntervalHelp")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Last Sync Status Card */}
          <Card className="shadow-lg border-muted/60 overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t("settingsPage.lastSyncStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-medium">{t("common.status")}:</span>
                {lastSyncStatus === "success" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                    <Check className="w-3.5 h-3.5" />
                    {t("settingsPage.syncSuccess")}
                  </span>
                )}
                {lastSyncStatus === "failed" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t("settingsPage.syncFailed")}
                  </span>
                )}
                {lastSyncStatus === "none" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border">
                    {t("settingsPage.syncNone")}
                  </span>
                )}
              </div>

              {lastSyncAt && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium block">
                    {t("settingsPage.lastSyncAt")}:
                  </span>
                  <span className="text-sm font-semibold">
                    {new Date(lastSyncAt).toLocaleString()}
                  </span>
                </div>
              )}

              {lastSyncStatus === "failed" && lastSyncMessage && (
                <Alert variant="destructive" className="mt-2 bg-destructive/5 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs font-bold">Details</AlertTitle>
                  <AlertDescription className="text-xs break-all leading-normal">
                    {lastSyncMessage}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="lg:col-span-3 flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
          {hasPermission(PERMISSIONS.LDAP_TEST) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="w-full sm:w-auto h-11 px-6 font-semibold"
            >
              {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
              {t("settingsPage.testConnection")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSaving || isTesting}
            className="w-full sm:w-auto h-11 px-6 font-semibold bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm transition-all"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {t("settingsPage.saveSettings")}
          </Button>
        </div>
      </form>
    </div>
  );
}
