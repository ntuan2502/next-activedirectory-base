"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchDebounce } from "@/hooks/use-search-debounce";
import { Network, Plus, Edit, Trash2, RefreshCw, Eye, Search, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

type DepartmentRecord = {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyId: string | null;
  parentId: string | null;
  managerId: string | null;
  companyObj?: {
    code: string;
    nameVi: string;
    nameEn: string;
  } | null;
  parentObj?: {
    code: string;
    nameVi: string;
    nameEn: string;
  };
  managerObj?: {
    username: string;
    displayName: string;
  };
  _count?: {
    users: number;
    children: number;
  };
};

type CompanyRecord = {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
};

export default function DepartmentsPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filter & Pagination States
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
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

  // Fetch Companies for filter dropdown
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch("/api/companies?limit=100");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setCompanies(data.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch companies list", err);
      }
    }
    fetchCompanies();
  }, []);

  const fetchDepartments = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (companyFilter !== "all") {
        params.set("companyId", companyFilter);
      }
      if (sortConfig) {
        params.set("sortBy", sortConfig.key);
        params.set("sortOrder", sortConfig.direction);
      }

      const res = await fetch(`/api/departments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDepartments(data.data || []);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotalCount(data.pagination?.totalCount || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch departments", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, companyFilter, sortConfig, isReady]);

  // Load initial state from URL search params on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get("page") || "1", 10);
      const l = parseInt(params.get("limit") || DEFAULT_LIMIT.toString(), 10);
      const s = params.get("search") || "";
      const cParam = params.get("companyId") || "all";
      const sb = params.get("sortBy") || "code";
      const so = params.get("sortOrder") || "asc";

      setPage(p);
      setLimit(l);
      setLocalSearch(s);
      setSearch(s);
      setCompanyFilter(cParam);
      setSortConfig({ key: sb, direction: so as "asc" | "desc" });
      setIsReady(true);
    });
  }, []);

  // Debounce search query input (1s delay)
  useSearchDebounce({ localSearch, isReady, setSearch, setPage });

  // Fetch departments when ready or query states change
  useEffect(() => {
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchDepartments();
    });
  }, [fetchDepartments, isReady]);

  // Synchronize state changes to URL query string
  useEffect(() => {
    if (!isReady) return;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (limit !== DEFAULT_LIMIT) params.set("limit", limit.toString());
    if (search.trim()) params.set("search", search.trim());
    if (companyFilter !== "all") params.set("companyId", companyFilter);
    if (sortConfig) {
      params.set("sortBy", sortConfig.key);
      params.set("sortOrder", sortConfig.direction);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [page, limit, search, companyFilter, sortConfig, isReady]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
  };

  const handleCompanyFilterChange = (val: string) => {
    setCompanyFilter(val);
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

  const handleDelete = async (dept: DepartmentRecord) => {
    const userCount = dept._count?.users || 0;
    const childCount = dept._count?.children || 0;

    if (userCount > 0) {
      return toast.error(t("errors.cannotDeleteDepartmentHasUsers"));
    }
    if (childCount > 0) {
      return toast.error(t("errors.cannotDeleteDepartmentHasSubDepartments"));
    }

    const deptName = locale === "vi" ? dept.nameVi : dept.nameEn;

    confirmAction({
      title: t("departmentsPage.deleteConfirmTitle"),
      description: (
        <span>
          {t("departmentsPage.deleteConfirmDesc")}
          <br />
          <strong>{dept.code} - {deptName}</strong>
        </span>
      ),
      actionText: t("common.delete"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/departments/${dept.id}`, { method: "DELETE" });
          if (res.ok) {
            setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
            setTotalCount((c) => Math.max(0, c - 1));
            toast.success(t("departmentsPage.successDelete"));
          } else {
            const data = await res.json();
            toast.error(data.error || t("departmentsPage.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  if (!hasPermission(PERMISSIONS.DEPARTMENTS_READ)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Network className="w-8 h-8 text-primary" />
            {t("departmentsPage.title")}
            {(totalCount > 0 || !isLoading) && (
              <Badge variant="secondary" className={`ml-2 translate-y-[2px] transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
                {totalCount} {t("permissions.groups.Departments Management").toLowerCase()}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("departmentsPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.DEPARTMENTS_CREATE) && (
            <Button
              onClick={() => router.push("/departments/new")}
              className="w-full sm:w-auto h-10 px-4 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("departmentsPage.addDepartment")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={fetchDepartments}
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
                placeholder={t("departmentsPage.searchPlaceholder")}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <div className="relative w-full sm:w-[220px]">
                <select
                  value={companyFilter}
                  onChange={(e) => handleCompanyFilterChange(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 rounded-md border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">{t("companiesPage.allCompanies")}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {locale === "vi" ? c.nameVi : c.nameEn}
                    </option>
                  ))}
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
                  {/* Code */}
                  <TableHead className="w-1/6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("code")}>
                    <div className="flex items-center">
                      {t("departmentsPage.tableHeaders.code")}
                      {sortConfig?.key === "code" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>

                  {/* Name VI */}
                  <TableHead className="w-1/5 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("nameVi")}>
                    <div className="flex items-center">
                      {t("departmentsPage.tableHeaders.nameVi")}
                      {sortConfig?.key === "nameVi" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>

                  {/* Name EN */}
                  <TableHead className="w-1/5 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("nameEn")}>
                    <div className="flex items-center">
                      {t("departmentsPage.tableHeaders.nameEn")}
                      {sortConfig?.key === "nameEn" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>

                  {/* Company */}
                  <TableHead className="w-1/6">{t("departmentsPage.tableHeaders.company")}</TableHead>

                  {/* Parent */}
                  <TableHead className="w-1/6">{t("departmentsPage.tableHeaders.parent")}</TableHead>

                  {/* Manager */}
                  <TableHead className="w-1/6">{t("departmentsPage.tableHeaders.manager")}</TableHead>

                  {/* Users Count */}
                  <TableHead className="w-24 text-center cursor-pointer hover:bg-muted/50" onClick={() => handleSort("usersCount")}>
                    <div className="flex items-center justify-center">
                      {t("departmentsPage.tableHeaders.usersCount")}
                      {sortConfig?.key === "usersCount" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>

                  <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={`transition-opacity duration-200 ${isLoading && departments.length > 0 ? "opacity-50" : ""}`}>
                {departments.length > 0 ? (
                  departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-bold">
                        {dept.code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {dept.nameVi}
                      </TableCell>
                      <TableCell className="font-medium">
                        {dept.nameEn}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dept.companyObj ? (
                          <span className="font-semibold text-foreground" title={locale === "vi" ? dept.companyObj.nameVi : dept.companyObj.nameEn}>
                            {dept.companyObj.code}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dept.parentObj ? (
                          <span className="font-medium text-foreground">
                            {dept.parentObj.code} - {locale === "vi" ? dept.parentObj.nameVi : dept.parentObj.nameEn}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic text-xs">{t("departmentsPage.none")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {dept.managerObj ? (
                          <span className="font-semibold text-foreground">
                            {dept.managerObj.username}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 italic text-xs">{t("departmentsPage.none")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{dept._count?.users || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/departments/${dept.id}`)}
                            title={t("departmentsPage.viewDepartment")}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasPermission(PERMISSIONS.DEPARTMENTS_UPDATE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/departments/${dept.id}/edit`)}
                              title={t("departmentsPage.editDepartment")}
                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission(PERMISSIONS.DEPARTMENTS_DELETE) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(dept)}
                              disabled={(dept._count?.users || 0) > 0 || (dept._count?.children || 0) > 0}
                              title={
                                (dept._count?.users || 0) > 0
                                  ? t("errors.cannotDeleteDepartmentHasUsers")
                                  : (dept._count?.children || 0) > 0
                                  ? t("errors.cannotDeleteDepartmentHasSubDepartments")
                                  : t("common.delete")
                              }
                              className={
                                ((dept._count?.users || 0) > 0 || (dept._count?.children || 0) > 0)
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
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {!isLoading && (search ? t("departmentsPage.noDepartmentsMatch") : t("departmentsPage.noDepartmentsFound"))}
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
                {t("rolesPage.showingRecords", { count: departments.length, total: totalCount })}
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
