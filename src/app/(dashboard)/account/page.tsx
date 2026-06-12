"use client";

import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, ShieldAlert } from "lucide-react";

export default function AccountPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("common.account")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("accountPage.description")}
        </p>
      </div>

      <Card className="border border-border bg-card shadow-sm rounded-lg overflow-hidden">
        <CardHeader className="bg-muted/10 border-b p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <User className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                {t("accountPage.profileInfo")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("accountPage.profileInfoDesc")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Username */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">
                {t("accountPage.username")}
              </span>
              <div className="flex items-center gap-2 text-foreground font-mono bg-muted/40 p-2.5 rounded-md border text-sm">
                <User className="h-4 w-4 text-muted-foreground/60" />
                <span>{user?.username}</span>
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">
                {t("accountPage.displayName")}
              </span>
              <div className="flex items-center gap-2 text-foreground bg-muted/40 p-2.5 rounded-md border text-sm">
                <User className="h-4 w-4 text-muted-foreground/60" />
                <span>{user?.displayName || "-"}</span>
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">
                {t("accountPage.email")}
              </span>
              <div className="flex items-center gap-2 text-foreground bg-muted/40 p-2.5 rounded-md border text-sm">
                <Mail className="h-4 w-4 text-muted-foreground/60" />
                <span>{user?.email || "-"}</span>
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">
                {t("accountPage.permissions")}
              </span>
              <div className="flex flex-wrap gap-1.5 bg-muted/20 p-4 rounded-lg border min-h-[60px]">
                {user?.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((perm) => (
                    <div
                      key={perm}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-xs font-semibold text-primary font-mono"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      {perm}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic flex items-center justify-center w-full">
                    {t("accountPage.noPermissions")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
