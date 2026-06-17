"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, Save, ArrowLeft, RefreshCw, CheckSquare, Square, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { LoadingSpinner } from "@/components/loading-overlay";
import { PERMISSIONS, AVAILABLE_PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
};

interface RoleEditorProps {
  roleId: string;
  mode: "view" | "edit";
}

export function RoleEditor({ roleId, mode }: RoleEditorProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [roleData, setRoleData] = useState<RoleRecord | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());
  const [initialState, setInitialState] = useState<{
    name: string;
    description: string;
    permissions: Set<string>;
  } | null>(null);

  const isReadOnly = mode === "view" || (roleData ? (roleData.isSystem || !hasPermission(PERMISSIONS.ROLES_UPDATE)) : false);

  const isSetEqual = (a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    for (const x of a) {
      if (!b.has(x)) return false;
    }
    return true;
  };

  const isChanged = !initialState ? false : (
    formName.trim() !== initialState.name ||
    formDescription.trim() !== initialState.description ||
    !isSetEqual(formPermissions, initialState.permissions)
  );

  const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    const group = perm.group || "Other";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const fetchRole = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const role = data.data;
          setRoleData(role);
          setFormName(role.name);
          setFormDescription(role.description || "");
          let perms = new Set<string>();
          try {
            const parsed = JSON.parse(role.permissions);
            perms = new Set(parsed);
          } catch {
            // ignore
          }
          setFormPermissions(perms);
          setInitialState({
            name: role.name,
            description: role.description || "",
            permissions: new Set(perms),
          });
        } else {
          toast.error(data.error || t("errors.roleNotFound"));
          router.push("/roles");
        }
      } else {
        toast.error(t("errors.roleNotFound"));
        router.push("/roles");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [roleId, t, router]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.ROLES_READ)) {
      Promise.resolve().then(() => fetchRole());
    }
  }, [fetchRole, hasPermission]);

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
      const res = await fetch(`/api/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          permissions: Array.from(formPermissions),
        }),
      });

      if (res.ok) {
        toast.success(t("rolesPage.successUpdate"));
        setInitialState({
          name: formName.trim(),
          description: formDescription.trim(),
          permissions: new Set(formPermissions),
        });
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

  if (!hasPermission(PERMISSIONS.ROLES_READ)) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              {isReadOnly ? t("rolesPage.viewRole") : t("rolesPage.editRole")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isReadOnly ? t("rolesPage.viewRoleDesc") : t("rolesPage.editRoleDesc")}: <strong className="text-foreground">{roleData?.name}</strong>
            </p>
          </div>
        </div>

        {mode === "view" && !roleData?.isSystem && hasPermission(PERMISSIONS.ROLES_UPDATE) && (
          <Button
            onClick={() => router.push(`/roles/${roleId}/edit`)}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2 self-start sm:self-center"
          >
            <Edit className="h-4 w-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card className="shadow-lg">
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
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
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
                  disabled={isReadOnly}
                  className="disabled:bg-muted/30"
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
            {roleData?.isSystem && (
              <CardDescription>
                {t("rolesPage.systemRoleNotice")}
              </CardDescription>
            )}
            {!roleData?.isSystem && isReadOnly && (
              <CardDescription>
                {t("rolesPage.readOnlyNotice")}
              </CardDescription>
            )}
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
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                        onClick={() => handleToggleGroupPermissions(perms)}
                      >
                        {allChecked ? t("rolesPage.deselectAll") : t("rolesPage.selectAll")}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {perms.map((perm) => {
                      const isChecked = roleData?.isSystem ? true : formPermissions.has(perm.id);
                      return (
                        <div
                          key={perm.id}
                          className={`flex items-start space-x-3 p-3 rounded-md border transition-colors ${isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-muted/50"
                            } ${isChecked ? "bg-primary/5 border-primary/20" : ""}`}
                          onClick={() => !isReadOnly && togglePermission(perm.id)}
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
            {isReadOnly ? t("common.close") : t("common.cancel")}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={isSaving || !formName.trim() || !isChanged}
              className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("common.save")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
