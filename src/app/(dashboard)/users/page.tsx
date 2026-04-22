"use client";

import { useState, useEffect, useCallback } from "react";
import { Users as UsersIcon, RefreshCw, Trash2, Lock, Unlock, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import Swal from "sweetalert2";

type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  department: string;
  disabled: boolean;
  roles: { id: string; name: string; isSystem: boolean }[];
};

type RoleRecord = {
  id: string;
  name: string;
  isSystem: boolean;
};

type UsersApiResponse = {
  success: boolean;
  data: UserRecord[];
};

type ApiErrorResponse = {
  error: string;
};

export default function UsersPage() {
  const { user } = useAuth();
  
  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user?.permissions]);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [availableRoles, setAvailableRoles] = useState<RoleRecord[]>([]);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserRecord | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setSelectedUserIds(new Set());
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data: UsersApiResponse | ApiErrorResponse = await res.json();
        if ("data" in data) {
          setUsers(data.data);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAvailableRoles(data.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const handleDelete = async (user: UserRecord) => {
    const result = await Swal.fire({
      title: "Delete user?",
      html: `Are you sure you want to delete <strong>${user.displayName || user.username}</strong>?<br/>This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setSelectedUserIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(user.id);
          return newSet;
        });
        await Swal.fire({
          title: "Deleted!",
          text: `${user.displayName || user.username} has been removed.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data: ApiErrorResponse = await res.json();
        await Swal.fire("Error", data.error || "Failed to delete user.", "error");
      }
    } catch {
      await Swal.fire("Error", "Network error. Please try again.", "error");
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    const actionText = user.disabled ? "Unlock" : "Disable";
    const result = await Swal.fire({
      title: `${actionText} user?`,
      html: `Are you sure you want to ${actionText.toLowerCase()} <strong>${user.displayName || user.username}</strong>?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: user.disabled ? "#10b981" : "#f59e0b",
      cancelButtonColor: "#6b7280",
      confirmButtonText: `Yes, ${actionText}`,
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: user.disabled ? "enable" : "disable", userIds: [user.id] })
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, disabled: !u.disabled } : u));
        await Swal.fire({
          title: "Success!",
          text: `${user.displayName || user.username} has been ${user.disabled ? "unlocked" : "disabled"}.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data: ApiErrorResponse = await res.json();
        await Swal.fire("Error", data.error || `Failed to ${actionText.toLowerCase()} user.`, "error");
      }
    } catch {
      await Swal.fire("Error", "Network error. Please try again.", "error");
    }
  };

  const handleBulkAction = async (action: "delete" | "disable" | "enable") => {
    if (selectedUserIds.size === 0) return;

    const actionText = action === "delete" ? "Delete" : action === "disable" ? "Disable" : "Unlock";
    const result = await Swal.fire({
      title: `${actionText} selected users?`,
      html: `Are you sure you want to ${actionText.toLowerCase()} <strong>${selectedUserIds.size}</strong> users?${action === "delete" ? "<br/>This action cannot be undone." : ""}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: action === "delete" ? "#ef4444" : action === "disable" ? "#f59e0b" : "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: `Yes, ${actionText}`,
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsBulkLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userIds: Array.from(selectedUserIds) })
      });
      if (res.ok) {
        if (action === "delete") {
          setUsers((prev) => prev.filter((u) => !selectedUserIds.has(u.id)));
        } else {
          const newDisabledState = action === "disable";
          setUsers((prev) => prev.map((u) => selectedUserIds.has(u.id) ? { ...u, disabled: newDisabledState } : u));
        }
        setSelectedUserIds(new Set());
        await Swal.fire({
          title: "Success!",
          text: `Action applied to ${selectedUserIds.size} users.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data: ApiErrorResponse = await res.json();
        await Swal.fire("Error", data.error || `Failed to perform bulk action.`, "error");
      }
    } catch {
      await Swal.fire("Error", "Network error. Please try again.", "error");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: keyof UserRecord; direction: "asc" | "desc" } | null>(null);

  const handleSort = (key: keyof UserRecord) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.department.toLowerCase().includes(q) ||
      user.title.toLowerCase().includes(q)
    );
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortConfig) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue < bValue) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const toggleSelectUser = (id: string, checked: boolean) => {
    const newSet = new Set(selectedUserIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedUserIds(newSet);
  };

  const openRoleDialog = (user: UserRecord) => {
    setRoleDialogUser(user);
    setSelectedRoleIds(new Set(user.roles?.map(r => r.id) || []));
    setIsRoleDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!roleDialogUser) return;
    setIsSavingRoles(true);
    try {
      const res = await fetch(`/api/users/${roleDialogUser.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: Array.from(selectedRoleIds) })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUsers(prev => prev.map(u => u.id === data.data.id ? data.data : u));
          setIsRoleDialogOpen(false);
          Swal.fire({ title: "Success", text: "Roles updated successfully.", icon: "success", timer: 1500, showConfirmButton: false });
        }
      } else {
        const errorData = await res.json();
        Swal.fire("Error", errorData.error || "Failed to update roles", "error");
      }
    } catch {
      Swal.fire("Error", "Network error.", "error");
    } finally {
      setIsSavingRoles(false);
    }
  };

  if (!hasPermission("users:read")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-2xl flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-primary" />
            Users
            {!isLoading && (
              <Badge variant="secondary">{filteredUsers.length} users</Badge>
            )}
          </CardTitle>
          <div className="flex gap-3 w-full sm:w-auto">
            {selectedUserIds.size > 0 && hasPermission("users:write") && (
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="secondary" disabled={isBulkLoading}>
                    Bulk Actions <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                } />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleBulkAction("enable")}>
                    <Unlock className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>Unlock Selected</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("disable")}>
                    <Lock className="mr-2 h-4 w-4 text-amber-500" />
                    <span>Disable Selected</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkAction("delete")} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Selected</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-64"
            />
            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading || isBulkLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table wrapperClassName="max-h-[calc(100vh-220px)]">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    {hasPermission("users:write") && (
                      <Checkbox 
                        checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    )}
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("username")}>
                    <div className="flex items-center">
                      Username
                      {sortConfig?.key === "username" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("displayName")}>
                    <div className="flex items-center">
                      Display Name
                      {sortConfig?.key === "displayName" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("email")}>
                    <div className="flex items-center">
                      Email
                      {sortConfig?.key === "email" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("title")}>
                    <div className="flex items-center">
                      Title / Role
                      {sortConfig?.key === "title" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("department")}>
                    <div className="flex items-center">
                      Department
                      {sortConfig?.key === "department" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("disabled")}>
                    <div className="flex items-center">
                      Status
                      {sortConfig?.key === "disabled" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  {(hasPermission("users:write") || hasPermission("roles:manage")) && (
                    <TableHead className="w-24 text-center">Action</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sortedUsers.length > 0 ? (
                  sortedUsers.map((user) => (
                    <TableRow key={user.id} className={user.disabled ? "opacity-60 bg-muted/30" : ""}>
                      <TableCell className="text-center">
                        {hasPermission("users:write") && (
                          <Checkbox 
                            checked={selectedUserIds.has(user.id)}
                            onCheckedChange={(checked) => toggleSelectUser(user.id, !!checked)}
                            aria-label={`Select ${user.username}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{user.username || "-"}</TableCell>
                      <TableCell>{user.displayName || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map(r => (
                              <Badge key={r.id} variant={r.isSystem ? "default" : "secondary"} className={r.isSystem ? "bg-purple-500 hover:bg-purple-600" : ""}>
                                {r.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-xs italic">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.title || "-"}</TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>
                        {user.disabled ? (
                          <Badge variant="destructive">Disabled</Badge>
                        ) : (
                          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Active</Badge>
                        )}
                      </TableCell>
                      {(hasPermission("users:write") || hasPermission("roles:manage")) && (
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            {hasPermission("roles:manage") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openRoleDialog(user)}
                                title="Manage Roles"
                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission("users:write") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleStatus(user)}
                                  title={user.disabled ? "Unlock User" : "Disable User"}
                                  className={user.disabled ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" : "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"}
                                >
                                  {user.disabled ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(user)}
                                  title="Delete User"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {search ? "No users match your search." : "No users found. Sync data from the Dashboard first."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles for {roleDialogUser?.displayName || roleDialogUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto space-y-2">
            {availableRoles.map(role => (
              <div key={role.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`role-${role.id}`} 
                  checked={selectedRoleIds.has(role.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedRoleIds);
                    if (checked) next.add(role.id);
                    else next.delete(role.id);
                    setSelectedRoleIds(next);
                  }}
                />
                <label htmlFor={`role-${role.id}`} className="text-sm font-medium leading-none cursor-pointer">
                  {role.name} {role.isSystem && <Badge variant="outline" className="ml-2 text-xs py-0 h-4">System</Badge>}
                </label>
              </div>
            ))}
            {availableRoles.length === 0 && (
              <p className="text-muted-foreground text-sm">No roles available.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} disabled={isSavingRoles}>Cancel</Button>
            <Button onClick={handleSaveRoles} disabled={isSavingRoles}>{isSavingRoles ? "Saving..." : "Save Roles"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
