"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Save, ArrowLeft, RefreshCw, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS, AVAILABLE_PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

export default function NewRolePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());

  const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    const group = perm.group || "Other";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const togglePermission = (permId: string) => {
    setFormPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const isAllGroupChecked = (perms: typeof AVAILABLE_PERMISSIONS) => {
    return perms.every((p) => formPermissions.has(p.id));
  };

  const handleToggleGroupPermissions = (perms: typeof AVAILABLE_PERMISSIONS) => {
    const allChecked = isAllGroupChecked(perms);
    setFormPermissions((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => {
        if (allChecked) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      return toast.error(t("rolesPage.roleNameRequired"));
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          permissions: Array.from(formPermissions),
        }),
      });

      if (res.ok) {
        toast.success(t("rolesPage.successCreate"));
        router.push("/roles");
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.failedToSave"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasPermission(PERMISSIONS.ROLES_CREATE)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/roles")}
          disabled={isSaving}
          className="h-10 w-10 cursor-pointer border-muted/70"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            {t("rolesPage.createRole")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("rolesPage.createRoleDesc")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {t("rolesPage.roleName")}
            </CardTitle>
            <CardDescription>
              {t("rolesPage.createRoleDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">
                  {t("rolesPage.roleName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t("rolesPage.roleNamePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="font-semibold">
                  {t("rolesPage.roleDescription")}
                </Label>
                <Input
                  id="description"
                  placeholder={t("rolesPage.roleDescPlaceholder")}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              {t("rolesPage.permissionsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedPermissions).map(([groupName, perms]) => {
              const allChecked = isAllGroupChecked(perms);
              return (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {t("permissions.groups." + groupName, { defaultValue: groupName })}
                    </h4>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                      onClick={() => handleToggleGroupPermissions(perms)}
                    >
                      {allChecked ? t("rolesPage.deselectAll") : t("rolesPage.selectAll")}
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {perms.map((perm) => {
                      const isChecked = formPermissions.has(perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`flex items-start space-x-3 p-3 rounded-md border transition-colors cursor-pointer hover:bg-muted/50 ${isChecked ? "bg-primary/5 border-primary/20" : ""}`}
                          onClick={() => togglePermission(perm.id)}
                        >
                          <div className="mt-0.5">
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col space-y-1">
                            <span className="text-sm font-medium leading-none">
                              {t("permissions.names." + perm.id, { defaultValue: perm.name })}
                            </span>
                            <span className="text-xs text-muted-foreground leading-normal">
                              {t("permissions.descriptions." + perm.id, { defaultValue: perm.description })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/roles")}
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !formName.trim()}
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
