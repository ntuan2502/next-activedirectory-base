"use client";

import { useState, useEffect, useCallback, useContext, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Shield, Save, ArrowLeft, RefreshCw, CheckSquare, Square, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS, AVAILABLE_PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import { RoleContext } from "./[id]/layout";

interface RoleEditorProps {
  roleId?: string;
  mode: "view" | "edit" | "create";
}

export function RoleEditor({ roleId, mode }: RoleEditorProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  // For create mode, context is null (no provider wrapping)
  const roleContext = useContext(RoleContext);
  const roleData = roleContext?.roleData ?? null;
  const setRoleData = roleContext?.setRoleData ?? null;

  const isCreateMode = mode === "create";

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isSaving, setIsSaving] = useState(false);

  // Parse permissions helper
  const parsedPermissions = (() => {
    if (!roleData?.permissions) return new Set<string>();
    try {
      const parsed = JSON.parse(roleData.permissions);
      return new Set<string>(parsed);
    } catch {
      return new Set<string>();
    }
  })();

  // Form State initialized directly from context to prevent first-render flash (blinking)
  const [formName, setFormName] = useState(roleData?.name || "");
  const [formDescription, setFormDescription] = useState(roleData?.description || "");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(parsedPermissions);
  const [initialState, setInitialState] = useState<{
    name: string;
    description: string;
    permissions: Set<string>;
  } | null>(roleData ? {
    name: roleData.name,
    description: roleData.description || "",
    permissions: new Set(parsedPermissions),
  } : null);

  useEffect(() => {
    if (roleData) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setFormName(roleData.name);
      setFormDescription(roleData.description || "");
      let perms = new Set<string>();
      try {
        const parsed = JSON.parse(roleData.permissions);
        perms = new Set(parsed);
      } catch {
        // ignore
      }
      setFormPermissions(perms);
      setInitialState({
        name: roleData.name,
        description: roleData.description || "",
        permissions: new Set(perms),
      });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [roleData]);

  const isReadOnly = mode === "view" || (roleData ? (roleData.isSystem || !hasPermission(PERMISSIONS.ROLES_UPDATE)) : false);

  const isSetEqual = (a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    for (const x of a) {
      if (!b.has(x)) return false;
    }
    return true;
  };

  // For create mode, always allow save if name is filled
  const isChanged = isCreateMode ? true : (
    !initialState ? false : (
      formName.trim() !== initialState.name ||
      formDescription.trim() !== initialState.description ||
      !isSetEqual(formPermissions, initialState.permissions)
    )
  );

  const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    const group = perm.group || "Other";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const groupEntries = Object.entries(groupedPermissions);
  const groupPairs: [[string, typeof AVAILABLE_PERMISSIONS], [string, typeof AVAILABLE_PERMISSIONS] | null][] = [];
  for (let i = 0; i < groupEntries.length; i += 2) {
    groupPairs.push([
      groupEntries[i],
      groupEntries[i + 1] || null
    ]);
  }

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
      const url = isCreateMode ? "/api/roles" : `/api/roles/${roleId}`;
      const method = isCreateMode ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          permissions: Array.from(formPermissions),
        }),
      });

      if (res.ok) {
        toast.success(isCreateMode ? t("rolesPage.successCreate") : t("rolesPage.successUpdate"));
        if (!isCreateMode) {
          setInitialState({
            name: formName.trim(),
            description: formDescription.trim(),
            permissions: new Set(formPermissions),
          });
          setRoleData?.((prev) => prev ? {
            ...prev,
            name: formName.trim(),
            description: formDescription.trim(),
            permissions: JSON.stringify(Array.from(formPermissions)),
          } : null);
        }
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

  // Permission check: create needs ROLES_CREATE, view/edit needs ROLES_READ
  if (isCreateMode && !hasPermission(PERMISSIONS.ROLES_CREATE)) {
    return <AccessDenied />;
  }
  if (!isCreateMode && !hasPermission(PERMISSIONS.ROLES_READ)) {
    return <AccessDenied />;
  }

  // Header title/description based on mode
  const headerTitle = isCreateMode
    ? t("rolesPage.createRole")
    : isReadOnly
      ? t("rolesPage.viewRole")
      : t("rolesPage.editRole");

  const headerDescription = isCreateMode
    ? t("rolesPage.createRoleDesc")
    : isReadOnly
      ? t("rolesPage.viewRoleDesc")
      : t("rolesPage.editRoleDesc");


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
              {headerTitle}
            </h1>
            <p className="text-muted-foreground mt-1">
              {headerDescription}
              {!isCreateMode && roleData?.name && (
                <>: <strong className="text-foreground">{roleData.name}</strong></>
              )}
            </p>
          </div>
        </div>

        {mode === "view" && hasPermission(PERMISSIONS.ROLES_UPDATE) && (
          <Button
            onClick={() => router.push(`/roles/${roleId}/edit`)}
            disabled={roleData?.isSystem}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2 self-start sm:self-center disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <Edit className="h-4 w-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Role Info */}
        <Card className="shadow-lg">
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold">
                  {t("rolesPage.roleName")} {!isReadOnly && <span className="text-destructive">*</span>}
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

        {/* Permissions */}
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
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              {groupPairs.map(([groupA, groupB], pairIndex) => {
                const [groupNameA, permsA] = groupA;
                const [groupNameB, permsB] = groupB || [null, null];

                const allCheckedA = isAllGroupChecked(permsA);
                const allCheckedB = permsB ? isAllGroupChecked(permsB) : false;

                const rowsA = Math.ceil(permsA.length / 2);
                const rowsB = permsB ? Math.ceil(permsB.length / 2) : 0;
                const maxRows = Math.max(rowsA, rowsB);

                const rowIndices = Array.from({ length: maxRows }, (_, i) => i);

                return (
                  <div key={pairIndex} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 lg:gap-y-4 pb-6 last:pb-0 border-b border-border/50 last:border-b-0">
                    {/* Headers */}
                    <div className="flex items-center justify-between border-b pb-1.5 col-span-1 sm:col-span-2 order-1 lg:order-none">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {t("permissions.groups." + groupNameA, { defaultValue: groupNameA })}
                      </h4>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                          onClick={() => handleToggleGroupPermissions(permsA)}
                        >
                          {allCheckedA ? t("rolesPage.deselectAll") : t("rolesPage.selectAll")}
                        </Button>
                      )}
                    </div>

                    {groupNameB && permsB ? (
                      <div className="flex items-center justify-between border-b pb-1.5 col-span-1 sm:col-span-2 order-3 lg:order-none">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {t("permissions.groups." + groupNameB, { defaultValue: groupNameB })}
                        </h4>
                        {!isReadOnly && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                            onClick={() => handleToggleGroupPermissions(permsB)}
                          >
                            {allCheckedB ? t("rolesPage.deselectAll") : t("rolesPage.selectAll")}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="hidden lg:block lg:col-span-2 lg:order-none" />
                    )}

                    {/* Rows of items */}
                    {rowIndices.map((r) => {
                      const itemA1 = permsA[r * 2];
                      const itemA2 = permsA[r * 2 + 1];
                      const itemB1 = permsB ? permsB[r * 2] : null;
                      const itemB2 = permsB ? permsB[r * 2 + 1] : null;

                      return (
                        <Fragment key={r}>
                          {/* Group A Item 1 */}
                          {itemA1 ? (
                            <div
                              className={`flex items-start space-x-3 p-3 rounded-md border transition-colors h-full col-span-1 order-2 lg:order-none ${
                                isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-muted/50"
                              } ${roleData?.isSystem || formPermissions.has(itemA1.id) ? "bg-primary/5 border-primary/20" : ""}`}
                              onClick={() => !isReadOnly && togglePermission(itemA1.id)}
                            >
                              <div className="mt-0.5">
                                {roleData?.isSystem || formPermissions.has(itemA1.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary" />
                                ) : (
                                  <Square className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-sm font-medium leading-none">
                                  {t("permissions.names." + itemA1.id, { defaultValue: itemA1.name })}
                                </span>
                                <span className="text-xs text-muted-foreground leading-normal">
                                  {t("permissions.descriptions." + itemA1.id, { defaultValue: itemA1.description })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="hidden lg:block lg:col-span-1 lg:order-none" />
                          )}

                          {/* Group A Item 2 */}
                          {itemA2 ? (
                            <div
                              className={`flex items-start space-x-3 p-3 rounded-md border transition-colors h-full col-span-1 order-2 lg:order-none ${
                                isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-muted/50"
                              } ${roleData?.isSystem || formPermissions.has(itemA2.id) ? "bg-primary/5 border-primary/20" : ""}`}
                              onClick={() => !isReadOnly && togglePermission(itemA2.id)}
                            >
                              <div className="mt-0.5">
                                {roleData?.isSystem || formPermissions.has(itemA2.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary" />
                                ) : (
                                  <Square className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-sm font-medium leading-none">
                                  {t("permissions.names." + itemA2.id, { defaultValue: itemA2.name })}
                                </span>
                                <span className="text-xs text-muted-foreground leading-normal">
                                  {t("permissions.descriptions." + itemA2.id, { defaultValue: itemA2.description })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="hidden lg:block lg:col-span-1 lg:order-none" />
                          )}

                          {/* Group B Item 1 */}
                          {itemB1 ? (
                            <div
                              className={`flex items-start space-x-3 p-3 rounded-md border transition-colors h-full col-span-1 order-4 lg:order-none ${
                                isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-muted/50"
                              } ${roleData?.isSystem || formPermissions.has(itemB1.id) ? "bg-primary/5 border-primary/20" : ""}`}
                              onClick={() => !isReadOnly && togglePermission(itemB1.id)}
                            >
                              <div className="mt-0.5">
                                {roleData?.isSystem || formPermissions.has(itemB1.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary" />
                                ) : (
                                  <Square className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-sm font-medium leading-none">
                                  {t("permissions.names." + itemB1.id, { defaultValue: itemB1.name })}
                                </span>
                                <span className="text-xs text-muted-foreground leading-normal">
                                  {t("permissions.descriptions." + itemB1.id, { defaultValue: itemB1.description })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="hidden lg:block lg:col-span-1 lg:order-none" />
                          )}

                          {/* Group B Item 2 */}
                          {itemB2 ? (
                            <div
                              className={`flex items-start space-x-3 p-3 rounded-md border transition-colors h-full col-span-1 order-4 lg:order-none ${
                                isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-muted/50"
                              } ${roleData?.isSystem || formPermissions.has(itemB2.id) ? "bg-primary/5 border-primary/20" : ""}`}
                              onClick={() => !isReadOnly && togglePermission(itemB2.id)}
                            >
                              <div className="mt-0.5">
                                {roleData?.isSystem || formPermissions.has(itemB2.id) ? (
                                  <CheckSquare className="w-5 h-5 text-primary" />
                                ) : (
                                  <Square className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex flex-col space-y-1">
                                <span className="text-sm font-medium leading-none">
                                  {t("permissions.names." + itemB2.id, { defaultValue: itemB2.name })}
                                </span>
                                <span className="text-xs text-muted-foreground leading-normal">
                                  {t("permissions.descriptions." + itemB2.id, { defaultValue: itemB2.description })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="hidden lg:block lg:col-span-1 lg:order-none" />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                );
              })}
            </div>
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
