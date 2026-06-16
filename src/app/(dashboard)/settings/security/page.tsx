"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Save, RefreshCw, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-overlay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { AccessDenied } from "@/components/access-denied";

type SettingsData = {
  passwordMinLength?: number;
  passwordPreventCommon?: boolean;
  passwordNoUserInfo?: boolean;
  passwordRequireLetter?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireSymbol?: boolean;
  passwordRequireMixedCase?: boolean;
};

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [passwordMinLength, setPasswordMinLength] = useState(8);
  const [passwordPreventCommon, setPasswordPreventCommon] = useState(false);
  const [passwordNoUserInfo, setPasswordNoUserInfo] = useState(false);
  const [passwordRequireLetter, setPasswordRequireLetter] = useState(false);
  const [passwordRequireNumber, setPasswordRequireNumber] = useState(false);
  const [passwordRequireSymbol, setPasswordRequireSymbol] = useState(false);
  const [passwordRequireMixedCase, setPasswordRequireMixedCase] = useState(false);

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
          setPasswordMinLength(d.passwordMinLength || 8);
          setPasswordPreventCommon(!!d.passwordPreventCommon);
          setPasswordNoUserInfo(!!d.passwordNoUserInfo);
          setPasswordRequireLetter(!!d.passwordRequireLetter);
          setPasswordRequireNumber(!!d.passwordRequireNumber);
          setPasswordRequireSymbol(!!d.passwordRequireSymbol);
          setPasswordRequireMixedCase(!!d.passwordRequireMixedCase);
          hasLoadedRef.current = true;
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateType: "security",
          passwordMinLength,
          passwordPreventCommon,
          passwordNoUserInfo,
          passwordRequireLetter,
          passwordRequireNumber,
          passwordRequireSymbol,
          passwordRequireMixedCase,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(t("settingsPage.saveSuccess"));
        if (result.data) {
          const d: SettingsData = result.data;
          setPasswordMinLength(d.passwordMinLength || 8);
          setPasswordPreventCommon(!!d.passwordPreventCommon);
          setPasswordNoUserInfo(!!d.passwordNoUserInfo);
          setPasswordRequireLetter(!!d.passwordRequireLetter);
          setPasswordRequireNumber(!!d.passwordRequireNumber);
          setPasswordRequireSymbol(!!d.passwordRequireSymbol);
          setPasswordRequireMixedCase(!!d.passwordRequireMixedCase);
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
            <Shield className="w-8 h-8 text-primary" />
            {t("settingsPage.securityTab")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("settingsPage.securityCardDesc")}
          </p>
        </div>
      </div>
 
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {t("settingsPage.passwordPolicy")}
            </CardTitle>
            <CardDescription>
              {t("settingsPage.passwordPolicyDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="passwordMinLength" className="font-semibold">
                {t("settingsPage.passwordMinLength")}
              </Label>
              <Input
                id="passwordMinLength"
                type="number"
                min={8}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Math.max(8, parseInt(e.target.value, 10)))}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsPage.passwordMinLengthHelp")}
              </p>
            </div>
 
            <div className="pt-4 border-t space-y-4">
              <Label className="font-bold text-sm block">
                {t("settingsPage.passwordComplexityTitle")}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/10 p-4 rounded-xl border">
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordPreventCommon"
                    checked={passwordPreventCommon}
                    onCheckedChange={(checked) => setPasswordPreventCommon(!!checked)}
                  />
                  <Label htmlFor="passwordPreventCommon" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordPreventCommon")}
                  </Label>
                </div>
 
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordNoUserInfo"
                    checked={passwordNoUserInfo}
                    onCheckedChange={(checked) => setPasswordNoUserInfo(!!checked)}
                  />
                  <Label htmlFor="passwordNoUserInfo" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordNoUserInfo")}
                  </Label>
                </div>
 
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordRequireLetter"
                    checked={passwordRequireLetter}
                    onCheckedChange={(checked) => setPasswordRequireLetter(!!checked)}
                  />
                  <Label htmlFor="passwordRequireLetter" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordRequireLetter")}
                  </Label>
                </div>
 
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordRequireNumber"
                    checked={passwordRequireNumber}
                    onCheckedChange={(checked) => setPasswordRequireNumber(!!checked)}
                  />
                  <Label htmlFor="passwordRequireNumber" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordRequireNumber")}
                  </Label>
                </div>
 
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordRequireSymbol"
                    checked={passwordRequireSymbol}
                    onCheckedChange={(checked) => setPasswordRequireSymbol(!!checked)}
                  />
                  <Label htmlFor="passwordRequireSymbol" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordRequireSymbol")}
                  </Label>
                </div>
 
                <div className="flex items-center space-x-2.5 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                  <Checkbox
                    id="passwordRequireMixedCase"
                    checked={passwordRequireMixedCase}
                    onCheckedChange={(checked) => setPasswordRequireMixedCase(!!checked)}
                  />
                  <Label htmlFor="passwordRequireMixedCase" className="text-sm font-semibold cursor-pointer select-none leading-normal">
                    {t("settingsPage.passwordRequireMixedCase")}
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
 
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/settings")}
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
