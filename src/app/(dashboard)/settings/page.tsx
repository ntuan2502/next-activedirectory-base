"use client";
 
import { useRouter } from "next/navigation";
import { Server, Shield, ArrowRight, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
 
export default function SettingsDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
 
  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };
 
  if (!hasPermission(PERMISSIONS.LDAP_SYNC)) {
    return <AccessDenied />;
  }
 
  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8 text-primary" />
          {t("common.settings")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("settingsPage.subtitle")}
        </p>
      </div>
 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* LDAP Configuration Card */}
        <Card 
          onClick={() => router.push("/settings/ldap")}
          className="group shadow-md border-muted/70 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg flex flex-col justify-between"
        >
          <CardHeader className="space-y-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Server className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-bold flex items-center justify-between">
                <span>{t("settingsPage.ldapTab")}</span>
              </CardTitle>
              <CardDescription className="text-sm leading-normal">
                {t("settingsPage.ldapCardDesc")}
              </CardDescription>
            </div>
          </CardHeader>
          <div className="px-4 pb-0 flex justify-end">
            <Button variant="ghost" className="p-0 text-primary font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1.5 cursor-pointer hover:bg-transparent">
              {t("settingsPage.configureNow")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
 
        {/* Security / Password Policy Card */}
        <Card 
          onClick={() => router.push("/settings/security")}
          className="group shadow-md border-muted/70 hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg flex flex-col justify-between"
        >
          <CardHeader className="space-y-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-bold flex items-center justify-between">
                <span>{t("settingsPage.securityTab")}</span>
              </CardTitle>
              <CardDescription className="text-sm leading-normal">
                {t("settingsPage.securityCardDesc")}
              </CardDescription>
            </div>
          </CardHeader>
          <div className="px-4 pb-0 flex justify-end">
            <Button variant="ghost" className="p-0 text-primary font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1.5 cursor-pointer hover:bg-transparent">
              {t("settingsPage.configureNow")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
 
      {/* System Information Panel */}
      <div className="mt-8 pt-6 border-t border-muted/50">
        <Card className="border-muted/50 bg-muted/10 shadow-sm">
          <CardHeader className="pb-4 border-b">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {t("settingsPage.systemInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold block">{t("settingsPage.app")}</span>
              <span className="font-medium">AD Sync Manager</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold block">{t("settingsPage.version")}</span>
              <span className="font-medium">v1.0.0-dev</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold block">{t("settingsPage.platform")}</span>
              <span className="font-medium">Next.js / Prisma</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-semibold block">{t("settingsPage.license")}</span>
              <span className="font-medium">MIT License</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
