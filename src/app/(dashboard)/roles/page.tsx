"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Edit, Trash2, CheckSquare, Square, RefreshCw, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { useLanguage } from "@/components/language-provider";
import { PERMISSIONS, AVAILABLE_PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
  _count?: {
    users: number;
  };
};

export default function RolesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPermissions, setFormPermissions] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description: React.ReactNode;
    actionText: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  } | null>(null);

  const confirmAction = (config: typeof confirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  };

  const isReadOnly = editingRole ? (editingRole.isSystem || !hasPermission(PERMISSIONS.ROLES_UPDATE)) : false;

  const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    const group = perm.group || "Other";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const fetchRoles = useCallback(async () => {
    await Promise.resolve();
    setIsLoading(true);
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRoles(data.data);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRoles();
    });
  }, [fetchRoles]);

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormName("");
    setFormDescription("");
    setFormPermissions(new Set());
    setIsDialogOpen(true);
  };

  const openEditDialog = (role: RoleRecord) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description || "");
    try {
      const perms = JSON.parse(role.permissions);
      setFormPermissions(new Set(perms));
    } catch {
      setFormPermissions(new Set());
    }
    setIsDialogOpen(true);
  };

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

  const handleSave = async () => {
    if (!formName.trim()) {
      return toast.error(t("rolesPage.roleNameRequired"));
    }

    setIsSaving(true);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";
      const body = JSON.stringify({
        name: formName.trim(),
        description: formDescription.trim(),
        permissions: Array.from(formPermissions),
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        await fetchRoles();
        setIsDialogOpen(false);
        toast.success(editingRole ? t("rolesPage.successUpdate") : t("rolesPage.successCreate"));
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

  const handleDelete = async (role: RoleRecord) => {
    if (role.isSystem) return;

    confirmAction({
      title: t("rolesPage.deleteConfirmTitle") || "Bạn có chắc chắn muốn xóa?",
      description: (
        <span>
          {t("rolesPage.deleteConfirmDesc") || "Hành động này không thể hoàn tác."}
          <br />
          <strong>{role.name}</strong>
        </span>
      ),
      actionText: t("common.delete") || "Xóa",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
          if (res.ok) {
            setRoles((prev) => prev.filter((r) => r.id !== role.id));
            toast.success(t("rolesPage.successDelete"));
          } else {
            const data = await res.json();
            toast.error(data.error || t("common.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  if (!hasPermission(PERMISSIONS.ROLES_READ)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            {t("rolesPage.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("rolesPage.description")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.ROLES_CREATE) && (
            <Button
              onClick={openCreateDialog}
              className="w-full sm:w-auto h-10 px-4 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("rolesPage.createRole")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={fetchRoles}
            disabled={isLoading}
            className="w-full sm:w-auto h-10 px-4 font-semibold text-sm cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-muted/60">
        <CardContent>
          <div className="overflow-x-auto relative">
            {isLoading && roles.length > 0 && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[0.5px] z-20 flex items-center justify-center pointer-events-auto animate-in fade-in duration-200">
                <div className="bg-background/90 p-4 rounded-xl shadow-lg border border-muted/80 flex flex-col items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">{t("common.loading")}</span>
                </div>
              </div>
            )}
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-1/4">{t("rolesPage.tableHeaders.name")}</TableHead>
                  <TableHead>{t("rolesPage.tableHeaders.description")}</TableHead>
                  <TableHead className="w-24 text-center">{t("rolesPage.tableHeaders.usersCount")}</TableHead>
                  <TableHead className="w-24 text-center">{t("rolesPage.tableHeaders.system")}</TableHead>
                  <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={`transition-opacity duration-200 ${isLoading && roles.length > 0 ? "opacity-50" : ""}`}>
                {isLoading && roles.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : roles.length > 0 ? (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{role._count?.users || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {role.isSystem ? (
                          <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">{t("common.yes")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("common.no")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          {role.isSystem || !hasPermission(PERMISSIONS.ROLES_UPDATE) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(role)}
                              title={t("rolesPage.viewRole")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(role)}
                              title={t("rolesPage.editRole")}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission(PERMISSIONS.ROLES_DELETE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(role)}
                              disabled={role.isSystem}
                              title={role.isSystem ? t("rolesPage.cannotDeleteSystemRole") : t("common.delete")}
                              className={role.isSystem ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive hover:bg-destructive/10"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {t("rolesPage.noRolesAvailable")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-7xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0 mb-2">
            <DialogTitle>{editingRole ? (isReadOnly ? t("rolesPage.viewRole") : t("rolesPage.editRole")) : t("rolesPage.createRole")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-6 min-h-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("rolesPage.roleName")} <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder={t("rolesPage.roleNamePlaceholder")}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={isReadOnly}
                />
                {editingRole?.isSystem && (
                  <p className="text-xs text-muted-foreground">{t("rolesPage.systemRoleWarning")}</p>
                )}
                {!editingRole?.isSystem && isReadOnly && (
                  <p className="text-xs text-muted-foreground">{t("rolesPage.noPermissionWarning")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("rolesPage.roleDescription")}</Label>
                <Input
                  id="description"
                  placeholder={t("rolesPage.roleDescPlaceholder")}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">{t("rolesPage.permissionsTitle")}</Label>
              {editingRole?.isSystem ? (
                <div className="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
                  {t("rolesPage.systemRoleNotice")}
                </div>
              ) : isReadOnly ? (
                <div className="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
                  {t("rolesPage.readOnlyNotice")}
                </div>
              ) : null}

              <div className="space-y-6">
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
                          const isChecked = editingRole?.isSystem ? true : formPermissions.has(perm.id);
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
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              {isReadOnly ? t("common.close") : t("common.cancel")}
            </Button>
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("rolesPage.saving") : t("rolesPage.saveChanges")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmOpen === false}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmOpen === false}
              onClick={() => {
                confirmConfig?.onConfirm();
                setConfirmOpen(false);
              }}
              variant={confirmConfig?.variant === "destructive" ? "destructive" : "default"}
            >
              {confirmConfig?.actionText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
