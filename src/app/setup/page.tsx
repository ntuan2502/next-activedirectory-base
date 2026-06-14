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
          }
        }
      } catch (err) {
        console.error("Failed to fetch setup status:", err);
      }
    };
    checkStatus();
  }, [router]);

  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !displayName || !email || !password) {
      toast.error(t("setupPage.errorRequiredFields") || "Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("setupPage.errorPasswordMismatch") || "Mật khẩu xác nhận không trùng khớp!");
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
        toast.success(t("setupPage.successAdmin") || "Đã tạo tài khoản quản trị cục bộ thành công.");
        setStep(2);
      } else {
        toast.error(result.error || t("setupPage.errorAdmin") || "Không thể đăng ký admin");
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
        toast.success(t("setupPage.successTest") || "Kiểm tra kết nối LDAP thành công.");
      } else {
        toast.error(data.error || t("setupPage.errorLdapTest") || "Kiểm tra kết nối thất bại");
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
          toast.success(t("setupPage.successSkip") || "Đã bỏ qua thiết lập LDAP.");
        } else {
          toast.success(t("setupPage.successLdap") || "Đã cấu hình LDAP thành công.");
        }
        router.replace("/login");
      } else {
        toast.error(result.error || t("setupPage.errorSaveLdap") || "Lưu cấu hình thất bại.");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return <LoadingOverlay show={true} variant="full" />;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Top bar with tools */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="w-36">
          <LanguageToggle />
        </div>
        <ThemeToggle className="w-32" />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-xl w-full mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl flex items-center justify-center gap-2">
            <Server className="w-8 h-8 text-primary animate-pulse" />
            {t("setupPage.title") || "Thiết lập hệ thống ban đầu"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("setupPage.subtitle") || "Cấu hình các thông số nền tảng để sẵn sàng vận hành ứng dụng Active Directory Sync."}
          </p>
        </div>

        {/* Stepper indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white"}`}>
              {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
            </div>
            <span className={`text-sm font-semibold ${step === 1 ? "text-foreground" : "text-muted-foreground"}`}>{t("setupPage.step1Title") || "Tạo Admin"}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border"}`}>
              2
            </div>
            <span className={`text-sm font-semibold ${step === 2 ? "text-foreground" : "text-muted-foreground"}`}>{t("setupPage.step2Title") || "Cấu hình LDAP"}</span>
          </div>
        </div>

        {/* Wizard step 1: Admin Account Creation */}
        {step === 1 && (
          <Card className="shadow-xl border-muted/70 animate-fade-in">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                {t("setupPage.step1Title") || "Đăng ký tài khoản Admin"}
              </CardTitle>
              <CardDescription>
                {t("setupPage.step1Desc") || "Tạo tài khoản quản trị viên tối cao cục bộ đầu tiên."}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRegisterAdmin}>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="font-semibold">{t("setupPage.username") || "Tên đăng nhập"} <span className="text-destructive">*</span></Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder="Ví dụ: superadmin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="font-semibold">{t("setupPage.displayName") || "Tên hiển thị"} <span className="text-destructive">*</span></Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder="Ví dụ: Nguyễn Văn A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold">{t("setupPage.email") || "Địa chỉ Email"} <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                    placeholder="Ví dụ: admin@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-semibold">{t("setupPage.password") || "Mật khẩu"} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                  <Label htmlFor="confirmPassword" className="font-semibold">{t("setupPage.confirmPassword") || "Xác nhận mật khẩu"} <span className="text-destructive">*</span></Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="focus-visible:ring-primary"
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 bg-muted/5 flex justify-end">
                <Button type="submit" disabled={isLoading} className="font-semibold h-10 px-6">
                  {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {t("setupPage.btnNext") || "Tiếp tục"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Wizard step 2: LDAP connection configuration */}
        {step === 2 && (
          <Card className="shadow-xl border-muted/70 animate-fade-in">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                {t("setupPage.step2Title") || "Cấu hình liên kết LDAP"}
              </CardTitle>
              <CardDescription>
                {t("setupPage.step2Desc") || "Thiết lập kết nối Active Directory (bước này có thể bỏ qua để cài đặt sau)."}
              </CardDescription>
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
                    placeholder={t("settingsPage.placeholderBindPasswordNew") || "Nhập mật khẩu kết nối LDAP"}
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
            <CardFooter className="border-t pt-4 bg-muted/5 flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleSaveLdap(true)}
                disabled={isLoading || isTesting}
                className="w-full sm:w-auto h-10 px-5 font-semibold"
              >
                {t("setupPage.btnSkip") || "Bỏ qua bước này"}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || isLoading || !ldapUrl || !ldapBindDn || !ldapBaseDn}
                  className="flex-1 sm:flex-none h-10 px-4 font-semibold"
                >
                  {isTesting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                  {t("settingsPage.testConnection") || "Kiểm tra kết nối"}
                </Button>
                <Button
                  onClick={() => handleSaveLdap(false)}
                  disabled={isLoading || isTesting || !ldapUrl || !ldapBindDn || !ldapBaseDn}
                  className="flex-1 sm:flex-none font-semibold h-10 px-6 bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  {t("setupPage.btnFinish") || "Hoàn thành"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
