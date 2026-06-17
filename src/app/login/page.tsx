"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, RefreshCw, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data: { success?: boolean; error?: string } = await res.json();

      if (res.ok && data.success) {
        await refreshSession();
        router.push("/");
        router.refresh();
      } else {
        toast.error(data.error || t("loginPage.invalidCredentials"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="w-36">
          <LanguageToggle />
        </div>
        <ThemeToggle className="w-32" />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t("loginPage.title")}</CardTitle>
          <CardDescription>
            {t("loginPage.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">{t("loginPage.username")}</Label>
              <Input
                id="username"
                type="text"
                placeholder={t("loginPage.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("loginPage.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("loginPage.passwordPlaceholder")}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>


            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              {isLoading ? t("loginPage.signingIn") : t("loginPage.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
