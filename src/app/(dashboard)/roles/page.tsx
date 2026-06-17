"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchDebounce } from "@/hooks/use-search-debounce";
import { Shield, Plus, Edit, Trash2, RefreshCw, Eye, Search, ChevronDown, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { useLanguage } from "@/components/language-provider";
import { LoadingOverlay } from "@/components/loading-overlay";
import { PERMISSIONS } from "@/config/permissions";
import { RowsPerPage } from "@/components/rows-per-page";
import { DEFAULT_LIMIT } from "@/config/constants";
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
  const router = useRouter();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filter & Pagination States
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isReady, setIsReady] = useState(false);

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

  const fetchRoles = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (typeFilter !== "all") {
        params.set("type", typeFilter);
      }
      if (sortConfig) {
        params.set("sortBy", sortConfig.key);
        params.set("sortOrder", sortConfig.direction);
      }

      const res = await fetch(`/api/roles?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRoles(data.data);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.totalCount);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, typeFilter, sortConfig, isReady]);

  // Load initial state from URL search params on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get("page") || "1", 10);
      const l = parseInt(params.get("limit") || DEFAULT_LIMIT.toString(), 10);
      const s = params.get("search") || "";
      const tParam = params.get("type") || "all";
      const sb = params.get("sortBy") || "name";
      const so = params.get("sortOrder") || "asc";

      setPage(p);
      setLimit(l);
      setLocalSearch(s);
      setSearch(s);
      setTypeFilter(tParam);
      setSortConfig({ key: sb, direction: so as "asc" | "desc" });
      setIsReady(true);
    });
  }, []);

  // Debounce search query input (1s delay)
  useSearchDebounce({ localSearch, isReady, setSearch, setPage });

  // Fetch roles when ready or query states change
  useEffect(() => {
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchRoles();
    });
  }, [fetchRoles, isReady]);

  // Synchronize state changes to URL query string
  useEffect(() => {
    if (!isReady) return;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (limit !== DEFAULT_LIMIT) params.set("limit", limit.toString());
    if (search.trim()) params.set("search", search.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (sortConfig) {
      params.set("sortBy", sortConfig.key);
      params.set("sortOrder", sortConfig.direction);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [page, limit, search, typeFilter, sortConfig, isReady]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
  };

  const handleFilterChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
    setPage(1);
  };

  const getRolePermissionsList = (permissionsStr: string): string[] => {
    try {
      const parsed = JSON.parse(permissionsStr);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const getPermissionName = (permId: string): string => {
    if (permId === "*") return t("accountPage.allPermissionsGranted");
    const nameKey = `permissions.names.${permId}`;
    const translated = t(nameKey);
    return translated !== nameKey ? translated : permId;
  };

  const handleDelete = async (role: RoleRecord) => {
    if (role.isSystem || (role._count?.users ?? 0) > 0) return;

    confirmAction({
      title: t("rolesPage.deleteConfirmTitle"),
      description: (
        <span>
          {t("rolesPage.deleteConfirmDesc")}
          <br />
          <strong>{role.name}</strong>
        </span>
      ),
      actionText: t("common.delete"),
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
            {(totalCount > 0 || !isLoading) && (
              <Badge variant="secondary" className={`ml-2 translate-y-[2px] transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
                {totalCount} {t("common.roles").toLowerCase()}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("rolesPage.description")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.ROLES_CREATE) && (
            <Button
              onClick={() => router.push("/roles/new")}
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
        <CardContent className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("rolesPage.searchPlaceholder")}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <div className="relative w-full sm:w-[220px]">
                <select
                  value={typeFilter}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="w-full h-8 pl-3 pr-8 rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">{t("rolesPage.filters.all")}</option>
                  <option value="system">{t("rolesPage.filters.system")}</option>
                  <option value="custom">{t("rolesPage.filters.custom")}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
              </div>

              <RowsPerPage
                value={limit}
                onChange={(newLimit) => {
                  setLimit(newLimit);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="overflow-x-auto relative mb-0">
            <LoadingOverlay show={isLoading} variant="table" />
            <Table wrapperClassName="mb-0" className="mb-0">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-1/5 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                    <div className="flex items-center">
                      {t("rolesPage.tableHeaders.name")}
                      {sortConfig?.key === "name" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-1/4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("description")}>
                    <div className="flex items-center">
                      {t("rolesPage.tableHeaders.description")}
                      {sortConfig?.key === "description" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="max-w-[400px]">{t("rolesPage.tableHeaders.permissions")}</TableHead>
                  <TableHead className="w-32 text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("usersCount")}>
                    <div className="flex items-center justify-center">
                      {t("rolesPage.tableHeaders.usersCount")}
                      {sortConfig?.key === "usersCount" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-28 text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("isSystem")}>
                    <div className="flex items-center justify-center">
                      {t("rolesPage.tableHeaders.system")}
                      {sortConfig?.key === "isSystem" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={`transition-opacity duration-200 ${isLoading && roles.length > 0 ? "opacity-50" : ""}`}>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description || "-"}
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const perms = getRolePermissionsList(role.permissions);
                            if (perms.includes("*")) {
                              return (
                                <Badge variant="destructive" className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white font-semibold">
                                  <ShieldAlert className="h-3 w-3" />
                                  {t("accountPage.allPermissionsGranted")}
                                </Badge>
                              );
                            }
                            if (perms.length > 0) {
                              return perms.map((perm) => (
                                <Badge key={perm} variant="outline" className="text-xs">
                                  {getPermissionName(perm)}
                                </Badge>
                              ));
                            }
                            return <span className="text-muted-foreground text-xs italic">{t("common.none")}</span>;
                          })()}
                        </div>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/roles/${role.id}`)}
                            title={t("rolesPage.viewRole")}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasPermission(PERMISSIONS.ROLES_UPDATE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/roles/${role.id}/edit`)}
                              disabled={role.isSystem}
                              title={role.isSystem ? t("rolesPage.systemRoleWarning") : t("rolesPage.editRole")}
                              className={role.isSystem ? "opacity-30 cursor-not-allowed" : "text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 cursor-pointer"}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission(PERMISSIONS.ROLES_DELETE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(role)}
                              disabled={role.isSystem || (role._count?.users ?? 0) > 0}
                              title={
                                role.isSystem
                                  ? t("rolesPage.cannotDeleteSystemRole")
                                  : (role._count?.users ?? 0) > 0
                                  ? t("rolesPage.cannotDeleteRoleHasUsers")
                                  : t("common.delete")
                              }
                              className={
                                (role.isSystem || (role._count?.users ?? 0) > 0)
                                  ? "opacity-30 cursor-not-allowed"
                                  : "text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                              }
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
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {!isLoading && (search ? t("rolesPage.noRolesMatch") : t("rolesPage.noRolesAvailable"))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t mt-2">
              <span className="text-sm text-muted-foreground">
                {t("rolesPage.showingRecords", { count: roles.length, total: totalCount })}
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
