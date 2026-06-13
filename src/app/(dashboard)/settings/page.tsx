"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Server, Save, RefreshCw, Eye, EyeOff, Check, AlertCircle, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { useSettings } from "@/components/settings-provider";
import { formatDateTimeCustom } from "@/lib/utils";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

type SyncTimeCountdownProps = {
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncInterval: number;
  dateFormat: string;
  timeFormat: string;
  locale: string;
};

function SyncTimeCountdown({
  syncEnabled,
  lastSyncAt,
  syncInterval,
  dateFormat,
  timeFormat,
  locale,
}: SyncTimeCountdownProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!syncEnabled || !lastSyncAt) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [syncEnabled, lastSyncAt]);

  if (!syncEnabled) {
    return (
      <>
        <div className="text-sm font-semibold text-muted-foreground">
          {locale === "vi" ? "Tự động đồng bộ đang tắt" : "Automatic sync is disabled"}
        </div>
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {locale === "vi" ? "Bật tự động đồng bộ để lên lịch" : "Enable automatic sync to start scheduling"}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="text-sm font-semibold text-foreground">
        {lastSyncAt ? (
          formatDateTimeCustom(
            new Date(new Date(lastSyncAt).getTime() + syncInterval * 60 * 1000),
            dateFormat,
            timeFormat,
            locale as "vi" | "en"
          )
        ) : (
          locale === "vi" ? "Chờ đồng bộ lần đầu" : "Pending initial sync"
        )}
      </div>
      <div className="text-xs font-medium text-primary flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        {(() => {
          if (!lastSyncAt) return locale === "vi" ? "Chưa có lịch sử đồng bộ" : "No sync history";
          const nextSync = new Date(new Date(lastSyncAt).getTime() + syncInterval * 60 * 1000);
          const diff = nextSync.getTime() - now.getTime();
          if (diff <= 0) return locale === "vi" ? "Đang xếp hàng đồng bộ..." : "Syncing shortly...";

          const totalSecs = Math.max(0, Math.floor(diff / 1000));
          const totalMins = Math.floor(totalSecs / 60);
          const hrs = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          const secs = totalSecs % 60;

          return locale === "vi"
            ? `Còn khoảng ${hrs > 0 ? hrs + " giờ " : ""}${mins > 0 || hrs > 0 ? mins + " phút " : ""}${secs} giây`
            : `Remaining ${hrs > 0 ? hrs + "h " : ""}${mins > 0 || hrs > 0 ? mins + "m " : ""}${secs}s`;
        })()}
      </div>
    </>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const { dateFormat, timeFormat } = useSettings();

  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [ldapUrl, setLdapUrl] = useState("");
  const [ldapPort, setLdapPort] = useState("");
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapBaseDn, setLdapBaseDn] = useState("");
  const [ldapFilter, setLdapFilter] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(1440);

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
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          const d: SettingsData = result.data;
          setLdapUrl(d.ldapUrl || "");
          setLdapPort(d.ldapPort !== null && d.ldapPort !== undefined ? String(d.ldapPort) : "");
          setLdapBindDn(d.ldapBindDn || "");
          const hasConfig = !!d.ldapUrl;
          setHasExistingConfig(hasConfig);
          setLdapBindPassword("");
          setLdapBaseDn(d.ldapBaseDn || "");
          setLdapFilter(d.ldapFilter || "");
          setSyncEnabled(d.syncEnabled);
          setSyncInterval(d.syncInterval);
          setLastSyncAt(d.lastSyncAt);
          setLastSyncStatus(d.lastSyncStatus);
          setLastSyncMessage(d.lastSyncMessage);
          hasLoadedRef.current = true;
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
        toast.success(t("settingsPage.successTest"));
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

  const handleSimulateSync = async () => {
    setShowSyncConfirm(false);
    setIsSimulatingSync(true);
    try {
      const res = await fetch("/api/ldap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("settingsPage.syncSuccess") || "Đồng bộ thành công!");
        setLastSyncAt(data.lastSyncAt);
        setLastSyncStatus(data.lastSyncStatus);
        setLastSyncMessage(data.lastSyncMessage || "Simulated automatic sync completed.");
      } else {
        toast.error(data.error || "Simulated sync failed.");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSimulatingSync(false);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Server className="w-8 h-8 text-primary" />
            {t("settingsPage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("settingsPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.LDAP_TEST) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={
                isTesting ||
                isSaving ||
                !ldapUrl ||
                !ldapPort ||
                !ldapBindDn ||
                !ldapBaseDn ||
                (!ldapBindPassword && !hasExistingConfig)
              }
              className="w-full sm:w-auto h-10 px-4 font-semibold text-sm cursor-pointer"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Server className="w-4 h-4 mr-2" />
              )}
              {t("settingsPage.testConnection")}
            </Button>
          )}
          <Button
            type="submit"
            form="settings-form"
            disabled={isSaving || isTesting}
            className="w-full sm:w-auto h-10 px-4 font-semibold text-sm bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm transition-all cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t("settingsPage.saveSettings")}
          </Button>
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <CardContent className="space-y-4">
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
                    placeholder={hasExistingConfig ? (t("settingsPage.placeholderBindPassword") || "Để trống để giữ mật khẩu cũ") : (t("settingsPage.placeholderBindPasswordNew") || "Nhập mật khẩu kết nối LDAP")}
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
            <CardContent className="space-y-4">
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
                    <option value={1}>1 {locale === "vi" ? "phút" : "minute"}</option>
                    <option value={60}>1 {t("settingsPage.hours")}</option>
                    <option value={360}>6 {t("settingsPage.hours")}</option>
                    <option value={720}>12 {t("settingsPage.hours")}</option>
                    <option value={1440}>24 {t("settingsPage.hours")} (1 {locale === "vi" ? "ngày" : "day"})</option>
                    <option value={2880}>48 {t("settingsPage.hours")} (2 {locale === "vi" ? "ngày" : "days"})</option>
                    <option value={10080}>168 {t("settingsPage.hours")} (1 {locale === "vi" ? "tuần" : "week"})</option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("settingsPage.syncIntervalHelp")}
                </p>
              </div>

              {/* Next Sync Info & Simulate Sync Button */}
              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2 p-3 bg-muted/20 border rounded-lg">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    {locale === "vi" ? "Thời gian đồng bộ kế tiếp" : "Next sync time"}
                  </span>
                  <div className="space-y-1">
                    <SyncTimeCountdown
                      syncEnabled={syncEnabled}
                      lastSyncAt={lastSyncAt}
                      syncInterval={syncInterval}
                      dateFormat={dateFormat}
                      timeFormat={timeFormat}
                      locale={locale}
                    />
                  </div>
                </div>

                <AlertDialog open={showSyncConfirm} onOpenChange={setShowSyncConfirm}>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSimulatingSync || isSaving || isTesting}
                        className="w-full text-xs font-semibold h-10 border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSimulatingSync ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                        {locale === "vi" ? "Đồng bộ ngay (Giả lập tự động)" : "Sync Now (Simulate Auto)"}
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {locale === "vi" ? "Xác nhận đồng bộ" : "Confirm Sync"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {locale === "vi" 
                          ? "Hành động này sẽ tải toàn bộ danh sách người dùng từ LDAP/Active Directory và cập nhật trực tiếp vào cơ sở dữ liệu. Quá trình này chạy giả lập tiến trình tự động và có thể mất một thời gian ngắn. Bạn có chắc muốn tiếp tục?"
                          : "This will fetch all users from LDAP/Active Directory and sync them with the database. This simulates the automatic sync background process and may take a moment. Are you sure you want to proceed?"}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {locale === "vi" ? "Hủy bỏ" : "Cancel"}
                      </AlertDialogCancel>
                      <AlertDialogAction onClick={handleSimulateSync}>
                        {locale === "vi" ? "Đồng bộ ngay" : "Sync Now"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
            <CardContent className="space-y-4">
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
                    {formatDateTimeCustom(lastSyncAt, dateFormat, timeFormat, locale as "vi" | "en")}
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
      </form>
    </div>
  );
}
