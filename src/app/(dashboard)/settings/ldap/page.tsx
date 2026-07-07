"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Server, Save, RefreshCw, Eye, EyeOff, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-overlay";
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
import { AccessDenied } from "@/components/access-denied";

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
  const { t } = useLanguage();

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
          {t("settingsPage.autoSyncDisabled")}
        </div>
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1 mt-1">
          <Clock className="w-3.5 h-3.5" />
          {t("settingsPage.enableAutoSyncToStart")}
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
            locale
          )
        ) : (
          t("settingsPage.pendingInitialSync")
        )}
      </div>
      <div className="text-xs font-medium text-primary flex items-center gap-1 mt-1">
        <Clock className="w-3.5 h-3.5" />
        {(() => {
          if (!lastSyncAt) return t("settingsPage.noSyncHistory");
          const nextSync = new Date(new Date(lastSyncAt).getTime() + syncInterval * 60 * 1000);
          const diff = nextSync.getTime() - now.getTime();
          if (diff <= 0) return t("settingsPage.syncingShortly");

          const totalSecs = Math.max(0, Math.floor(diff / 1000));
          const totalMins = Math.floor(totalSecs / 60);
          const hrs = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          const secs = totalSecs % 60;

          const timeStr = `${hrs > 0 ? hrs + t("settingsPage.timeUnits.hour") : ""}${
            mins > 0 || hrs > 0 ? mins + t("settingsPage.timeUnits.minute") : ""
          }${secs}${t("settingsPage.timeUnits.second")}`;

          return t("settingsPage.syncRemaining", { time: timeStr });
        })()}
      </div>
    </>
  );
}

export default function LdapSettingsPage() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const { dateFormat, timeFormat } = useSettings();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSimulatingSync, setIsSimulatingSync] = useState(false);
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
  const [lastTestedConfig, setLastTestedConfig] = useState<string>("");
  const [initialSettings, setInitialSettings] = useState<SettingsData | null>(null);

  const [showLdapDemo, setShowLdapDemo] = useState(false);
  const [demoLdapData, setDemoLdapData] = useState<{
    ldapUrl?: string;
    ldapPort?: string;
    ldapBindDn?: string;
    ldapBindPassword?: string;
    ldapBaseDn?: string;
    ldapFilter?: string;
  }>({});

  const isChanged = !initialSettings ? false : (
    ldapUrl !== (initialSettings.ldapUrl || "") ||
    ldapPort !== (initialSettings.ldapPort !== null && initialSettings.ldapPort !== undefined ? String(initialSettings.ldapPort) : "") ||
    ldapBindDn !== (initialSettings.ldapBindDn || "") ||
    ldapBindPassword !== "" ||
    ldapBaseDn !== (initialSettings.ldapBaseDn || "") ||
    ldapFilter !== (initialSettings.ldapFilter || "") ||
    syncEnabled !== !!initialSettings.syncEnabled ||
    syncInterval !== initialSettings.syncInterval
  );

  const currentLdapConfig = JSON.stringify({
    ldapUrl,
    ldapPort,
    ldapBindDn,
    ldapBindPassword,
    ldapBaseDn,
    ldapFilter,
  });

  const isLdapConfigValid = !!(
    ldapUrl.trim() &&
    ldapPort &&
    ldapBindDn.trim() &&
    ldapBaseDn.trim() &&
    (ldapBindPassword || hasExistingConfig)
  );

  const isConfigTested = currentLdapConfig === lastTestedConfig;

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
          setInitialSettings(d);

          // Set initial tested config to avoid forcing test connection on load
          setLastTestedConfig(JSON.stringify({
            ldapUrl: d.ldapUrl || "",
            ldapPort: d.ldapPort !== null && d.ldapPort !== undefined ? String(d.ldapPort) : "",
            ldapBindDn: d.ldapBindDn || "",
            ldapBindPassword: "",
            ldapBaseDn: d.ldapBaseDn || "",
            ldapFilter: d.ldapFilter || "",
          }));
        }
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.LDAP_SYNC)) {
      Promise.resolve().then(() => loadSettings());
    }
  }, [loadSettings, hasPermission]);

  useEffect(() => {
    const fetchDemoConfig = async () => {
      try {
        const res = await fetch("/api/setup/demo-config");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setShowLdapDemo(data.hasLdapDemo);
            setDemoLdapData(data.ldap || {});
          }
        }
      } catch (err) {
        console.error("Failed to load demo config", err);
      }
    };
    if (hasPermission(PERMISSIONS.LDAP_SYNC)) {
      fetchDemoConfig();
    }
  }, [hasPermission]);

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
        setLastTestedConfig(currentLdapConfig);
      } else {
        toast.error(data.error || t("setupPage.errorLdapTest"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ldapUrl || !ldapBindDn || !ldapBaseDn) {
      toast.error(t("errors.missingRequiredLdapSettingsFields"));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateType: "ldap",
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
        setLdapBindPassword("");

        // Update last tested config as password input is cleared
        setLastTestedConfig(JSON.stringify({
          ldapUrl,
          ldapPort,
          ldapBindDn,
          ldapBindPassword: "",
          ldapBaseDn,
          ldapFilter,
        }));

        if (result.data) {
          const d: SettingsData = result.data;
          setLastSyncAt(d.lastSyncAt);
          setLastSyncStatus(d.lastSyncStatus);
          setLastSyncMessage(d.lastSyncMessage);
          setInitialSettings({
            ...d,
            ldapUrl,
            ldapPort: parseInt(ldapPort, 10),
            ldapBindDn,
            ldapBaseDn,
            ldapFilter,
            syncEnabled,
            syncInterval,
          });
        } else {
          setInitialSettings({
            ldapUrl,
            ldapPort: parseInt(ldapPort, 10),
            ldapBindDn,
            ldapBaseDn,
            ldapFilter,
            syncEnabled,
            syncInterval,
            lastSyncAt,
            lastSyncStatus,
            lastSyncMessage,
          });
        }
      } else {
        toast.error(result.error || t("settingsPage.saveFailed"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFillDemo = () => {
    if (demoLdapData) {
      if (demoLdapData.ldapUrl !== undefined) setLdapUrl(demoLdapData.ldapUrl);
      if (demoLdapData.ldapPort !== undefined) setLdapPort(demoLdapData.ldapPort);
      if (demoLdapData.ldapBindDn !== undefined) setLdapBindDn(demoLdapData.ldapBindDn);
      if (demoLdapData.ldapBindPassword !== undefined) setLdapBindPassword(demoLdapData.ldapBindPassword);
      if (demoLdapData.ldapBaseDn !== undefined) setLdapBaseDn(demoLdapData.ldapBaseDn);
      if (demoLdapData.ldapFilter !== undefined) setLdapFilter(demoLdapData.ldapFilter);
      toast.success(t("common.success"));
    }
  };

  const handleSyncNow = async () => {
    setIsSimulatingSync(true);
    try {
      const res = await fetch("/api/ldap/sync-now", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t("settingsPage.syncSuccess"));
        setLastSyncAt(data.lastSyncAt);
        setLastSyncStatus(data.lastSyncStatus);
        setLastSyncMessage(data.lastSyncMessage || t("settingsPage.syncSimulationSuccess"));
      } else {
        toast.error(data.error || t("settingsPage.syncSimulationFailed"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSimulatingSync(false);
    }
  };

  if (!hasPermission(PERMISSIONS.LDAP_SYNC)) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/settings")}
          className="h-10 w-10 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Server className="w-8 h-8 text-primary" />
            {t("settingsPage.ldapCard")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("settingsPage.ldapCardDesc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <form id="ldap-settings-form" onSubmit={handleSaveSettings} noValidate>
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4 flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Server className="w-5 h-5 text-primary" />
                    {t("settingsPage.ldapParameters")}
                  </CardTitle>
                  <CardDescription>
                    {t("settingsPage.ldapParametersDesc")}
                  </CardDescription>
                </div>
                {showLdapDemo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillDemo}
                    className="font-semibold h-8 text-xs cursor-pointer flex items-center gap-1 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    {t("common.fillDemo")}
                  </Button>
                )}
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
                      placeholder={hasExistingConfig ? t("settingsPage.placeholderBindPassword") : t("settingsPage.placeholderBindPasswordNew")}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapFilter" className="font-semibold">{t("settingsPage.ldapFilter")}</Label>
                  <Input
                    id="ldapFilter"
                    placeholder={t("settingsPage.placeholderFilter")}
                    value={ldapFilter}
                    onChange={(e) => setLdapFilter(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {t("settingsPage.syncScheduler")}
              </CardTitle>
              <CardDescription>
                {t("settingsPage.syncSchedulerDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-xl border">
                <Checkbox
                  id="syncEnabled"
                  checked={syncEnabled}
                  onCheckedChange={(checked) => setSyncEnabled(!!checked)}
                />
                <Label htmlFor="syncEnabled" className="font-semibold cursor-pointer select-none">
                  {t("settingsPage.syncEnabled")}
                </Label>
              </div>

              {syncEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="syncInterval" className="font-semibold">
                    {t("settingsPage.syncInterval")}
                  </Label>
                  <select
                    id="syncInterval"
                    value={syncInterval}
                    onChange={(e) => setSyncInterval(parseInt(e.target.value, 10))}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <option value="60">{t("settingsPage.syncIntervals.60")}</option>
                    <option value="120">{t("settingsPage.syncIntervals.120")}</option>
                    <option value="240">{t("settingsPage.syncIntervals.240")}</option>
                    <option value="480">{t("settingsPage.syncIntervals.480")}</option>
                    <option value="720">{t("settingsPage.syncIntervals.720")}</option>
                    <option value="1440">{t("settingsPage.syncIntervals.1440")}</option>
                    <option value="10080">{t("settingsPage.syncIntervals.10080")}</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t("settingsPage.syncIntervalHelp")}
                  </p>
                </div>
              )}

              {/* Next Sync Countdown Card */}
              <div className="bg-muted/10 border p-4 rounded-xl space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {t("settingsPage.nextSyncTime")}
                </span>
                <SyncTimeCountdown
                  syncEnabled={syncEnabled}
                  lastSyncAt={lastSyncAt}
                  syncInterval={syncInterval}
                  dateFormat={dateFormat}
                  timeFormat={timeFormat}
                  locale={locale}
                />
              </div>

              {/* Sync Status Badge Info */}
              {lastSyncAt && (
                <div className="bg-muted/10 border p-4 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    {t("settingsPage.recentSyncStatus")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{t("settingsPage.syncResult")}</span>
                    {lastSyncStatus === "success" ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600">{t("common.success")}</Badge>
                    ) : lastSyncStatus === "failed" ? (
                      <Badge variant="destructive">{t("settingsPage.syncFailed")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("settingsPage.syncNone")}</Badge>
                    )}
                  </div>
                  {lastSyncMessage && (
                    <p className="text-xs text-muted-foreground leading-normal mt-1 border-t pt-1.5">
                      {lastSyncMessage}
                    </p>
                  )}
                </div>
              )}

              {/* Sync now trigger button */}
              {hasPermission(PERMISSIONS.LDAP_SYNC) && (
                <Button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSimulatingSync || isSaving || !isLdapConfigValid}
                  className="w-full h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold cursor-pointer"
                >
                  {isSimulatingSync ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Activity className="w-4 h-4 mr-2" />
                  )}
                  {t("settingsPage.syncNow")}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
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
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
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
          form="ldap-settings-form"
          disabled={isSaving || isTesting || !isLdapConfigValid || !isConfigTested || !isChanged}
          className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
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
  );
}

// Add simple activity icon for fallback inside page file if not imported from lucide-react
function Activity({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
