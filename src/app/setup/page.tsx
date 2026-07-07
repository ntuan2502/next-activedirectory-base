"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Server, UserCheck, KeyRound, Eye, EyeOff, ArrowRight, RefreshCw, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export default function InitialSetupPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLdapPassword, setShowLdapPassword] = useState(false);

  // Step 1: Admin Registration Form States
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: LDAP Configuration Form States
  const [ldapUrl, setLdapUrl] = useState("");
  const [ldapPort, setLdapPort] = useState("");
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapBaseDn, setLdapBaseDn] = useState("");
  const [ldapFilter, setLdapFilter] = useState("");

  const [lastTestedConfig, setLastTestedConfig] = useState<string>("not_tested");

  const [showAdminDemo, setShowAdminDemo] = useState(false);
  const [showLdapDemo, setShowLdapDemo] = useState(false);
  const [demoData, setDemoData] = useState<{
    admin?: {
      username?: string;
      displayName?: string;
      email?: string;
      password?: string;
    };
    ldap?: {
      ldapUrl?: string;
      ldapPort?: string;
      ldapBindDn?: string;
      ldapBindPassword?: string;
      ldapBaseDn?: string;
      ldapFilter?: string;
    };
  }>({});

  const currentLdapConfig = JSON.stringify({
    ldapUrl,
    ldapPort,
    ldapBindDn,
    ldapBindPassword,
    ldapBaseDn,
    ldapFilter,
  });

  const isLdapConfigValid = ldapUrl.trim() && ldapPort && ldapBindDn.trim() && ldapBindPassword && ldapBaseDn.trim();
  const isConfigTested = currentLdapConfig === lastTestedConfig;

  // Verify setup status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (res.ok) {
          const data = await res.json();
          if (data.isSetup) {
            router.replace("/login");
          } else {
            setIsReady(true);
            if (data.adminExists) {
              setStep(2);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkStatus();
  }, [router]);

  useEffect(() => {
    const fetchDemoConfig = async () => {
      try {
        const res = await fetch("/api/setup/demo-config");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setShowAdminDemo(data.hasAdminDemo);
            setShowLdapDemo(data.hasLdapDemo);
            setDemoData({ admin: data.admin, ldap: data.ldap });
          }
        }
      } catch (err) {
        console.error("Failed to load demo config", err);
      }
    };
    fetchDemoConfig();
  }, []);

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !displayName || !email || !password) {
      toast.error(t("setupPage.errorRequiredFields"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("setupPage.errorPasswordMismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/setup/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, email, password }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        toast.success(t("setupPage.successAdmin"));
        setStep(2);
      } else {
        toast.error(result.error || t("setupPage.errorAdmin"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

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
        toast.success(t("setupPage.successTest"));
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

  const handleSaveLdap = async (isSkipped = false) => {
    setIsLoading(true);
    try {
      const payload = isSkipped
        ? { skip: true }
        : {
            skip: false,
            ldapUrl,
            ldapPort: parseInt(ldapPort, 10),
            ldapBindDn,
            ldapBindPassword,
            ldapBaseDn,
            ldapFilter,
          };

      const res = await fetch("/api/setup/ldap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        if (isSkipped) {
          toast.success(t("setupPage.successSkip"));
        } else {
          toast.success(t("setupPage.successLdap"));
        }
        router.replace("/login");
      } else {
        toast.error(result.error || t("setupPage.errorSaveLdap"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    if (demoData.admin) {
      if (demoData.admin.username !== undefined) setUsername(demoData.admin.username);
      if (demoData.admin.displayName !== undefined) setDisplayName(demoData.admin.displayName);
      if (demoData.admin.email !== undefined) setEmail(demoData.admin.email);
      if (demoData.admin.password !== undefined) {
        setPassword(demoData.admin.password);
        setConfirmPassword(demoData.admin.password);
      }
      toast.success(t("common.success"));
    }
  };

  const handleFillDemoLdap = () => {
    if (demoData.ldap) {
      if (demoData.ldap.ldapUrl !== undefined) setLdapUrl(demoData.ldap.ldapUrl);
      if (demoData.ldap.ldapPort !== undefined) setLdapPort(demoData.ldap.ldapPort);
      if (demoData.ldap.ldapBindDn !== undefined) setLdapBindDn(demoData.ldap.ldapBindDn);
      if (demoData.ldap.ldapBindPassword !== undefined) setLdapBindPassword(demoData.ldap.ldapBindPassword);
      if (demoData.ldap.ldapBaseDn !== undefined) setLdapBaseDn(demoData.ldap.ldapBaseDn);
      if (demoData.ldap.ldapFilter !== undefined) setLdapFilter(demoData.ldap.ldapFilter);
      toast.success(t("common.success"));
    }
  };

  if (!isReady) {
    return <LoadingOverlay show={true} variant="full" />;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-between py-8 px-4 relative">
      {/* Top bar with tools */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="w-36">
          <LanguageToggle />
        </div>
        <ThemeToggle className="w-32" />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-2xl w-full mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl flex items-center justify-center gap-2">
            <Server className="w-8 h-8 text-primary animate-pulse" />
            {t("setupPage.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("setupPage.subtitle")}
          </p>
        </div>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white"}`}>
              {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
            </div>
            <span className={`text-sm font-semibold ${step === 1 ? "text-foreground" : "text-muted-foreground"}`}>{t("setupPage.step1Title")}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border"}`}>
              2
            </div>
            <span className={`text-sm font-semibold ${step === 2 ? "text-foreground" : "text-muted-foreground"}`}>{t("setupPage.step2Title")}</span>
          </div>
        </div>

        {/* Wizard step 1: Admin Account Creation */}
        {step === 1 && (
          <form onSubmit={handleRegisterAdmin} noValidate>
            <Card className="shadow-xl border-muted/70 animate-fade-in">
              <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" />
                    {t("setupPage.step1Title")}
                  </CardTitle>
                  <CardDescription>
                    {t("setupPage.step1Desc")}
                  </CardDescription>
                </div>
                {showAdminDemo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillDemoAdmin}
                    className="font-semibold h-8 text-xs cursor-pointer flex items-center gap-1 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    {t("common.fillDemo")}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0 pb-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="font-semibold">{t("setupPage.username")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder={t("setupPage.usernamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-semibold">{t("setupPage.displayName")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder={t("setupPage.displayNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold">{t("setupPage.email")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder={t("setupPage.emailPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-semibold">{t("setupPage.password")} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("setupPage.placeholderPassword")}
                      required
                      className="pr-10 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-semibold">{t("setupPage.confirmPassword")} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("setupPage.placeholderConfirmPassword")}
                      required
                      className="pr-10 focus-visible:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t p-4 bg-muted/5 flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading || !username.trim() || !displayName.trim() || !email.trim() || !password || !confirmPassword}
                  className="font-semibold h-10 px-6"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {t("setupPage.btnNext")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}

        {/* Wizard step 2: LDAP connection configuration */}
        {step === 2 && (
          <Card className="shadow-xl border-muted/70 animate-fade-in">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  {t("setupPage.step2Title")}
                </CardTitle>
                <CardDescription>
                  {t("setupPage.step2Desc")}
                </CardDescription>
              </div>
              {showLdapDemo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFillDemoLdap}
                  className="font-semibold h-8 text-xs cursor-pointer flex items-center gap-1 border-primary/30 text-primary hover:bg-primary/5"
                >
                  {t("common.fillDemo")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0 pb-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 space-y-2">
                  <Label htmlFor="ldapUrl" className="font-semibold">{t("settingsPage.ldapServerUrl")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="ldapUrl"
                    placeholder={t("settingsPage.placeholderUrl")}
                    value={ldapUrl}
                    onChange={(e) => setLdapUrl(e.target.value)}
                    className="focus-visible:ring-primary"
                  />
                </div>
                <div className="md:col-span-4 space-y-2">
                  <Label htmlFor="ldapPort" className="font-semibold">{t("settingsPage.ldapPort")} <span className="text-destructive">*</span></Label>
                  <Input
                    id="ldapPort"
                    type="number"
                    value={ldapPort}
                    onChange={(e) => setLdapPort(e.target.value)}
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
                  className="focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ldapBindPassword" className="font-semibold">{t("settingsPage.ldapBindPassword")} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="ldapBindPassword"
                    type={showLdapPassword ? "text" : "password"}
                    value={ldapBindPassword}
                    onChange={(e) => setLdapBindPassword(e.target.value)}
                    placeholder={t("settingsPage.placeholderBindPasswordNew")}
                    className="pr-10 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLdapPassword(!showLdapPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLdapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            <CardFooter className="border-t p-4 bg-muted/5 flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleSaveLdap(true)}
                disabled={isLoading || isTesting}
                className="w-full sm:w-auto h-10 px-5 font-semibold"
              >
                {t("setupPage.btnSkip")}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || isLoading || !ldapUrl.trim() || !ldapPort || !ldapBindDn.trim() || !ldapBindPassword || !ldapBaseDn.trim()}
                  className="flex-1 sm:flex-none h-10 px-4 font-semibold"
                >
                  {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                  {t("settingsPage.testConnection")}
                </Button>
                <Button
                  onClick={() => handleSaveLdap(false)}
                  disabled={isLoading || isTesting || !isLdapConfigValid || !isConfigTested}
                  className="flex-1 sm:flex-none font-semibold h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {t("setupPage.btnFinish")}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
