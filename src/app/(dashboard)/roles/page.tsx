"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Edit, Trash2, CheckSquare, Square, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS, AVAILABLE_PERMISSIONS } from "@/config/permissions";
import Swal from "sweetalert2";

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

  const fetchRoles = useCallback(async () => {
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
    fetchRoles();
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

  const handleSave = async () => {
    if (!formName.trim()) {
      return Swal.fire("Error", "Role name is required.", "error");
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
        Swal.fire({
          title: "Success!",
          text: `Role has been ${editingRole ? "updated" : "created"}.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data = await res.json();
        Swal.fire("Error", data.error || "Failed to save role.", "error");
      }
    } catch {
      Swal.fire("Error", "Network error. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (role: RoleRecord) => {
    if (role.isSystem) return;

    const result = await Swal.fire({
      title: "Delete role?",
      html: `Are you sure you want to delete <strong>${role.name}</strong>?<br/>Any users assigned to this role will lose its permissions.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
      if (res.ok) {
        setRoles((prev) => prev.filter((r) => r.id !== role.id));
        Swal.fire({
          title: "Deleted!",
          text: `Role ${role.name} has been deleted.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data = await res.json();
        Swal.fire("Error", data.error || "Failed to delete role.", "error");
      }
    } catch {
      Swal.fire("Error", "Network error. Please try again.", "error");
    }
  };

  if (!hasPermission(PERMISSIONS.ROLES_MANAGE)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Roles & Permissions
            </CardTitle>
            <CardDescription>
              Manage access control roles and assign them to users.
            </CardDescription>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={fetchRoles} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-1/4">Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-center">Users</TableHead>
                  <TableHead className="w-24 text-center">System</TableHead>
                  <TableHead className="w-24 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
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
                          <Badge variant="default" className="bg-purple-500 hover:bg-purple-600">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(role)}
                            title="Edit Role"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(role)}
                            disabled={role.isSystem}
                            title={role.isSystem ? "System roles cannot be deleted" : "Delete Role"}
                            className={role.isSystem ? "opacity-50 cursor-not-allowed" : "text-destructive hover:text-destructive hover:bg-destructive/10"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No roles found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="e.g. HR Manager"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={editingRole?.isSystem}
                />
                {editingRole?.isSystem && (
                  <p className="text-xs text-muted-foreground">System role names cannot be changed.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g. Can manage users and sync LDAP"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              {editingRole?.isSystem ? (
                <div className="p-4 bg-muted/50 rounded-md border text-sm text-muted-foreground">
                  System roles inherently have all permissions or bypass checks. Modifying specific permissions here may not restrict their access.
                </div>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border rounded-md p-4 bg-card">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const isChecked = formPermissions.has(perm.id);
                  return (
                    <div
                      key={perm.id}
                      className={`flex items-start space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${isChecked ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"}`}
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
                        <span className="text-sm font-medium leading-none">{perm.name}</span>
                        <span className="text-xs text-muted-foreground">{perm.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
