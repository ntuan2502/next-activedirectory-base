"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchDebounce } from "@/hooks/use-search-debounce";
import { Users as UsersIcon, Search, RefreshCw, Trash2, Lock, Unlock, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { RowsPerPage } from "@/components/rows-per-page";
import { DEFAULT_LIMIT } from "@/config/constants";
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
import { getPageNumbers } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  company: string;
  disabled: boolean;
  roles: { id: string; name: string; isSystem: boolean }[];
};

type RoleRecord = {
  id: string;
  name: string;
  isSystem: boolean;
};

type ApiErrorResponse = {
  error: string;
};

type LdapUserPreview = {
  username: string;
  displayName: string;
  email: string;
  department: string;
  company: string;
  title: string;
  isSyncable?: boolean;
  isTest?: boolean;
};

type SyncSuccessResponse = {
  success: boolean;
  syncedCount: number;
};

export default function UsersPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [availableRoles, setAvailableRoles] = useState<RoleRecord[]>([]);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<UserRecord | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: keyof UserRecord; direction: "asc" | "desc" } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // LDAP Sync Preview States
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<LdapUserPreview[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSearch, setSyncSearch] = useState("");
  const [syncSortConfig, setSyncSortConfig] = useState<{ key: keyof LdapUserPreview; direction: "asc" | "desc" } | null>(null);

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

  // Load initial state from URL search params on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get("page") || "1", 10);
      const l = parseInt(params.get("limit") || DEFAULT_LIMIT.toString(), 10);
      const s = params.get("search") || "";
      const sb = params.get("sortBy") || "username";
      const so = params.get("sortOrder") || "asc";

      setPage(p);
      setLimit(l);
      setLocalSearch(s);
      setSearch(s);
      setSortConfig({ key: sb as keyof UserRecord, direction: so as "asc" | "desc" });
      setIsReady(true);
    });
  }, []);

  // Debounce search query input (1s delay)
  useSearchDebounce({ localSearch, isReady, setSearch, setPage });

  // Synchronize state changes to URL query string
  useEffect(() => {
    if (!isReady) return;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (limit !== DEFAULT_LIMIT) params.set("limit", limit.toString());
    if (search.trim()) params.set("search", search.trim());
    if (sortConfig) {
      params.set("sortBy", sortConfig.key);
      params.set("sortOrder", sortConfig.direction);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [page, limit, search, sortConfig, isReady]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
  };

  const fetchUsers = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);
    setSelectedUserIds(new Set());
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (sortConfig) {
        params.set("sortBy", sortConfig.key);
        params.set("sortOrder", sortConfig.direction);
      }

      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUsers(data.data);
          setTotalCount(data.pagination.totalCount);
          setTotalPages(data.pagination.totalPages);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, sortConfig, isReady]);

  // Helper functions for LDAP Sync
  const isSyncableUser = useCallback((u: LdapUserPreview) => {
    return !!u.isSyncable;
  }, []);

  const fetchPreview = useCallback(async () => {
    setIsPreviewLoading(true);
    setPreviewUsers([]);
    setSelectedUsernames(new Set());

    try {
      const res = await fetch("/api/ldap/sync");
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewUsers(data.data);
        const validUsers = data.data.filter((u: LdapUserPreview) => isSyncableUser(u));
        setSelectedUsernames(new Set(validUsers.map((u: LdapUserPreview) => u.username)));
      }
    } catch (error) {
      console.error("Failed to fetch preview", error);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [isSyncableUser]);

  const handleOpenSyncDialog = useCallback((open: boolean) => {
    setIsSyncDialogOpen(open);
    if (open) {
      fetchPreview();
    }
  }, [fetchPreview]);

  const filteredPreviewUsers = useMemo(() => {
    const q = syncSearch.toLowerCase();
    return previewUsers.filter((u: LdapUserPreview) =>
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      (u.company || "").toLowerCase().includes(q) ||
      (u.title || "").toLowerCase().includes(q)
    );
  }, [previewUsers, syncSearch]);

  const toggleSelectAllPreview = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedUsernames(new Set(filteredPreviewUsers.filter((u: LdapUserPreview) => isSyncableUser(u)).map((u: LdapUserPreview) => u.username)));
    } else {
      setSelectedUsernames(new Set());
    }
  }, [filteredPreviewUsers, isSyncableUser]);

  const toggleSelectPreviewUser = useCallback((username: string, checked: boolean) => {
    setSelectedUsernames((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(username);
      } else {
        next.delete(username);
      }
      return next;
    });
  }, []);

  const handleConfirmSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/ldap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernamesToSync: Array.from(selectedUsernames) }),
      });
      const data: SyncSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "syncedCount" in data) {
        toast.success(t("usersPage.successSync", { count: data.syncedCount }));
        setIsSyncDialogOpen(false);
        // Refresh users list in Users Page directly
        fetchUsers();
      } else if (res.ok === false && "error" in data) {
        toast.error(data.error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("common.networkError");
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [selectedUsernames, t, fetchUsers]);

  const handleSyncSort = useCallback((key: keyof LdapUserPreview) => {
    setSyncSortConfig((prev) => {
      let direction: "asc" | "desc" = "asc";
      if (prev && prev.key === key && prev.direction === "asc") {
        direction = "desc";
      }
      return { key, direction };
    });
  }, []);

  const sortedPreviewUsers = useMemo(() => {
    if (!syncSortConfig) return filteredPreviewUsers;
    return [...filteredPreviewUsers].sort((a, b) => {
      const aValue = a[syncSortConfig.key] || "";
      const bValue = b[syncSortConfig.key] || "";

      if (aValue < bValue) {
        return syncSortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return syncSortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredPreviewUsers, syncSortConfig]);

  const syncableUsersCount = useMemo(() => {
    return filteredPreviewUsers.filter((u: LdapUserPreview) => isSyncableUser(u)).length;
  }, [filteredPreviewUsers, isSyncableUser]);

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
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchRoles();
    });
  }, [fetchRoles, isReady]);

  useEffect(() => {
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchUsers();
    });
  }, [fetchUsers, isReady]);

  const handleDelete = async (user: UserRecord) => {
    confirmAction({
      title: t("rolesPage.deleteConfirmTitle") || "Bạn có chắc chắn muốn xóa?",
      description: (
        <span>
          {t("rolesPage.deleteConfirmDesc") || "Hành động này không thể hoàn tác."}
          <br />
          <strong>{user.displayName || user.username}</strong>
        </span>
      ),
      actionText: t("common.delete") || "Xóa",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
          if (res.ok) {
            setSelectedUserIds((prev) => {
              const newSet = new Set(prev);
              newSet.delete(user.id);
              return newSet;
            });
            toast.success(t("usersPage.successBulkDelete"));
            fetchUsers();
          } else {
            const data: ApiErrorResponse = await res.json();
            toast.error(data.error || t("usersPage.failedToDeleteUser"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const handleToggleStatus = async (user: UserRecord) => {
    const actionDesc = user.disabled ? t("usersPage.enableSelected") : t("usersPage.disableSelected");
    confirmAction({
      title: t("common.confirm") || "Xác nhận",
      description: (
        <span>
          {actionDesc} <strong>{user.displayName || user.username}</strong>?
        </span>
      ),
      actionText: t("common.confirm") || "Xác nhận",
      variant: user.disabled ? "default" : "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/users/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: user.disabled ? "enable" : "disable", userIds: [user.id] })
          });
          if (res.ok) {
            setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, disabled: !u.disabled } : u));
            toast.success(user.disabled ? t("usersPage.successBulkEnable") : t("usersPage.successBulkDisable"));
          } else {
            const data: ApiErrorResponse = await res.json();
            toast.error(data.error || (user.disabled ? t("usersPage.failedToEnable") : t("usersPage.failedToDisable")));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const handleBulkAction = async (action: "delete" | "disable" | "enable") => {
    if (selectedUserIds.size === 0) return;

    const actionDesc = action === "delete"
      ? t("usersPage.deleteSelected")
      : action === "disable"
        ? t("usersPage.disableSelected")
        : t("usersPage.enableSelected");

    confirmAction({
      title: t("common.confirm") || "Xác nhận",
      description: (
        <span>
          {actionDesc} <strong>{selectedUserIds.size}</strong> users?
        </span>
      ),
      actionText: t("common.confirm") || "Xác nhận",
      variant: action === "delete" || action === "disable" ? "destructive" : "default",
      onConfirm: async () => {
        setIsBulkLoading(true);
        try {
          const res = await fetch("/api/users/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, userIds: Array.from(selectedUserIds) })
          });
          if (res.ok) {
            setSelectedUserIds(new Set());
            toast.success(action === "delete" ? t("usersPage.successBulkDelete") : action === "disable" ? t("usersPage.successBulkDisable") : t("usersPage.successBulkEnable"));
            fetchUsers();
          } else {
            const data: ApiErrorResponse = await res.json();
            toast.error(data.error || t("usersPage.failedBulkAction"));
          }
        } catch {
          toast.error(t("common.networkError"));
        } finally {
          setIsBulkLoading(false);
        }
      }
    });
  };

  const handleSort = (key: keyof UserRecord) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(new Set(users.map(u => u.id)));
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
          toast.success(t("usersPage.successUpdateRoles"));
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || t("usersPage.failedToUpdateRoles"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSavingRoles(false);
    }
  };

  if (!hasPermission(PERMISSIONS.USERS_READ)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-primary" />
            {t("common.users")}
            {!isLoading && (
              <Badge variant="secondary" className="ml-2">{totalCount} {t("common.users").toLowerCase()}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("usersPage.subtitle")}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.LDAP_SYNC) && (
            <Button onClick={() => handleOpenSyncDialog(true)} className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold">
              <UsersIcon className="w-4 h-4 mr-2" />
              {t("usersPage.syncData")}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading || isBulkLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-muted/60">
        <CardContent className="pt-6 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("usersPage.searchPlaceholder")}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              {selectedUserIds.size > 0 && (hasPermission(PERMISSIONS.USERS_UPDATE) || hasPermission(PERMISSIONS.USERS_DELETE)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger render={
                    <Button variant="secondary" className="h-8" disabled={isBulkLoading}>
                      {t("usersPage.bulkActions")} <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  } />
                  <DropdownMenuContent align="end">
                    {hasPermission(PERMISSIONS.USERS_UPDATE) && (
                      <>
                        <DropdownMenuItem onClick={() => handleBulkAction("enable")}>
                          <Unlock className="mr-2 h-4 w-4 text-emerald-500" />
                          <span>{t("usersPage.enableSelected")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBulkAction("disable")}>
                          <Lock className="mr-2 h-4 w-4 text-amber-500" />
                          <span>{t("usersPage.disableSelected")}</span>
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasPermission(PERMISSIONS.USERS_DELETE) && (
                      <DropdownMenuItem onClick={() => handleBulkAction("delete")} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{t("usersPage.deleteSelected")}</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <RowsPerPage
                value={limit}
                onChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table wrapperClassName="max-h-[calc(100vh-220px)]">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    {(hasPermission(PERMISSIONS.USERS_UPDATE) || hasPermission(PERMISSIONS.USERS_DELETE)) && (
                      <Checkbox
                        checked={selectedUserIds.size === users.length && users.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    )}
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("username")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.username")}
                      {sortConfig?.key === "username" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("displayName")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.displayName")}
                      {sortConfig?.key === "displayName" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("email")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.email")}
                      {sortConfig?.key === "email" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead>{t("common.roles")}</TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("title")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.title")}
                      {sortConfig?.key === "title" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("department")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.department")}
                      {sortConfig?.key === "department" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("company")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.company")}
                      {sortConfig?.key === "company" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("disabled")}>
                    <div className="flex items-center">
                      {t("usersPage.tableHeaders.status")}
                      {sortConfig?.key === "disabled" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  {(hasPermission(PERMISSIONS.USERS_UPDATE) || hasPermission(PERMISSIONS.USERS_DELETE)) && (
                    <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id} className={user.disabled ? "opacity-60 bg-muted/30" : ""}>
                      <TableCell className="text-center">
                        {(hasPermission(PERMISSIONS.USERS_UPDATE) || hasPermission(PERMISSIONS.USERS_DELETE)) && (
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
                            <span className="text-muted-foreground text-xs italic">{t("common.none")}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.title || "-"}</TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>{user.company || "-"}</TableCell>
                      <TableCell>
                        {user.disabled ? (
                          <Badge variant="destructive">{t("usersPage.status.disabled")}</Badge>
                        ) : (
                          <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">{t("usersPage.status.active")}</Badge>
                        )}
                      </TableCell>
                      {(hasPermission(PERMISSIONS.USERS_UPDATE) || hasPermission(PERMISSIONS.USERS_DELETE)) && (
                        <TableCell className="text-center">
                          <div className="flex justify-center items-center gap-1">
                            {hasPermission(PERMISSIONS.USERS_UPDATE) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openRoleDialog(user)}
                                  title={t("usersPage.updateRoles")}
                                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleStatus(user)}
                                  title={user.disabled ? t("usersPage.enableSelected") : t("usersPage.disableSelected")}
                                  className={user.disabled ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" : "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"}
                                >
                                  {user.disabled ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </Button>
                              </>
                            )}
                            {hasPermission(PERMISSIONS.USERS_DELETE) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(user)}
                                title={t("common.delete")}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      {search ? t("usersPage.noUsersMatch") : t("usersPage.noUsersFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t mt-4">
              <span className="text-sm text-muted-foreground">
                {t("usersPage.showingRecords", { count: users.length, total: totalCount })}
              </span>
              <Pagination className="w-auto mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {t("common.previous")}
                    </PaginationPrevious>
                  </PaginationItem>

                  {getPageNumbers(page, totalPages).map((pageNum, index) => (
                    <PaginationItem key={index}>
                      {typeof pageNum === "string" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          isActive={page === pageNum}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      {t("common.next")}
                    </PaginationNext>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("usersPage.rolesTitle")} - {roleDialogUser?.displayName || roleDialogUser?.username}</DialogTitle>
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
                  {role.name} {role.isSystem && <Badge variant="outline" className="ml-2 text-xs py-0 h-4">{t("common.system")}</Badge>}
                </label>
              </div>
            ))}
            {availableRoles.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("rolesPage.noRolesAvailable")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} disabled={isSavingRoles}>{t("common.cancel")}</Button>
            <Button onClick={handleSaveRoles} disabled={isSavingRoles}>{isSavingRoles ? t("rolesPage.saving") : t("usersPage.updateRoles")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSyncDialogOpen} onOpenChange={handleOpenSyncDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-7xl w-full max-h-[85vh] flex flex-col p-4 md:p-6 overflow-hidden">
          <DialogHeader className="shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {t("usersPage.syncPreviewTitle")}
                {!isPreviewLoading && (
                  <Badge variant="secondary">{filteredPreviewUsers.length} {t("common.users").toLowerCase()}</Badge>
                )}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("usersPage.syncPreviewDesc")}
              </DialogDescription>
            </div>
            <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <Input
                placeholder={t("usersPage.syncSearchPlaceholder")}
                value={syncSearch}
                onChange={(e) => setSyncSearch(e.target.value)}
                className="sm:w-64"
              />
              <Button variant="outline" size="icon" onClick={fetchPreview} disabled={isPreviewLoading}>
                <RefreshCw className={`h-4 w-4 ${isPreviewLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {isPreviewLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPreviewUsers.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {syncSearch ? t("usersPage.noUsersMatch") : t("usersPage.noLdapUsersFound")}
              </div>
            ) : (
              <div className="border rounded-md flex-1 overflow-hidden flex flex-col">
                <Table wrapperClassName="max-h-[60vh]">
                  <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <Checkbox
                          checked={selectedUsernames.size === syncableUsersCount && syncableUsersCount > 0}
                          onCheckedChange={toggleSelectAllPreview}
                          aria-label="Select all"
                          disabled={syncableUsersCount === 0}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("username")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.username")}
                          {syncSortConfig?.key === "username" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("displayName")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.displayName")}
                          {syncSortConfig?.key === "displayName" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("email")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.email")}
                          {syncSortConfig?.key === "email" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("title")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.title")}
                          {syncSortConfig?.key === "title" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("department")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.department")}
                          {syncSortConfig?.key === "department" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSyncSort("company")}>
                        <div className="flex items-center">
                          {t("usersPage.syncTableHeaders.company")}
                          {syncSortConfig?.key === "company" ? (syncSortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPreviewUsers.map((u: LdapUserPreview) => {
                      const hasEmail = u.email && u.email.trim() !== "";
                      const isTest = !!u.isTest;
                      const isSyncable = !!u.isSyncable;
                      return (
                        <TableRow key={u.username} className={!isSyncable ? "opacity-60 bg-muted/20" : ""}>
                          <TableCell className="w-12 text-center">
                            <Checkbox
                              checked={selectedUsernames.has(u.username)}
                              onCheckedChange={(checked) => toggleSelectPreviewUser(u.username, !!checked)}
                              aria-label={`Select ${u.username}`}
                              disabled={!isSyncable}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell>{u.displayName}</TableCell>
                          <TableCell>
                            {hasEmail ? (
                              <div className="flex items-center gap-2">
                                <span>{u.email}</span>
                                {isTest && (
                                  <Badge variant="outline" className="text-destructive border-destructive text-[10px] py-0 px-1.5 h-4 font-semibold">
                                    {t("usersPage.testAccount")}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-destructive text-xs font-semibold">{t("usersPage.missingEmail")}</span>
                            )}
                          </TableCell>
                          <TableCell>{u.title || "-"}</TableCell>
                          <TableCell>{u.department || "-"}</TableCell>
                          <TableCell>{u.company || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 shrink-0">
            <div className="flex w-full items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">
                {t("usersPage.validUsersSelected", { selected: selectedUsernames.size, total: syncableUsersCount })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button
                  onClick={handleConfirmSync}
                  disabled={isSyncing || selectedUsernames.size === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold"
                >
                  {isSyncing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  {isSyncing ? t("usersPage.syncing") : t("usersPage.confirmSync")}
                </Button>
              </div>
            </div>
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
