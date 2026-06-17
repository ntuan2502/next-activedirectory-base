"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSearchDebounce } from "@/hooks/use-search-debounce";
import { Building2, Plus, Edit, Trash2, RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
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

type CompanyRecord = {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  taxAddress: string;
  taxCode: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
};

type ApiErrorResponse = {
  error: string;
};

type GetCompaniesSuccessResponse = {
  success: boolean;
  data: CompanyRecord[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

export default function CompaniesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const hasPermission = useCallback((perm: string): boolean => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search, Filter & Pagination States
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({ key: "code", direction: "asc" });
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

  const confirmAction = useCallback((config: typeof confirmConfig) => {
    setConfirmConfig(config);
    setConfirmOpen(true);
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);
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

      const res = await fetch(`/api/companies?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as GetCompaniesSuccessResponse;
        if (data.success) {
          setCompanies(data.data);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.totalCount);
        }
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, sortConfig, isReady, t]);

  // Load initial state from URL search params on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get("page") || "1", 10);
      const l = parseInt(params.get("limit") || DEFAULT_LIMIT.toString(), 10);
      const s = params.get("search") || "";
      const sb = params.get("sortBy") || "code";
      const so = params.get("sortOrder") || "asc";

      setPage(p);
      setLimit(l);
      setLocalSearch(s);
      setSearch(s);
      setSortConfig({ key: sb, direction: so as "asc" | "desc" });
      setIsReady(true);
    });
  }, []);

  // Debounce search query input (1s delay)
  useSearchDebounce({ localSearch, isReady, setSearch, setPage });

  // Fetch companies when ready or query states change
  useEffect(() => {
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchCompanies();
    });
  }, [fetchCompanies, isReady]);

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

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
    setPage(1);
  };

  const handleDelete = async (company: CompanyRecord) => {
    confirmAction({
      title: t("companiesPage.deleteConfirmTitle"),
      description: (
        <span>
          {t("companiesPage.deleteConfirmDesc")}
          <br />
          <strong>{company.code} - {company.nameVi || company.nameEn || t("common.none")}</strong>
        </span>
      ),
      actionText: t("common.delete"),
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
          if (res.ok) {
            setCompanies((prev) => prev.filter((c) => c.id !== company.id));
            toast.success(t("companiesPage.successDelete"));
            fetchCompanies();
          } else {
            const data = (await res.json()) as ApiErrorResponse;
            toast.error(data.error || t("companiesPage.failedToDelete"));
          }
        } catch {
          toast.error(t("common.networkError"));
        }
      }
    });
  };

  const pageNumbers = useMemo(() => {
    return getPageNumbers(page, totalPages);
  }, [page, totalPages]);

  const showActions = hasPermission(PERMISSIONS.COMPANIES_READ) || 
                      hasPermission(PERMISSIONS.COMPANIES_UPDATE) || 
                      hasPermission(PERMISSIONS.COMPANIES_DELETE);

  if (!hasPermission(PERMISSIONS.COMPANIES_READ)) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-primary" />
            {t("companiesPage.title")}
            {(totalCount > 0 || !isLoading) && (
              <Badge variant="secondary" className={`ml-2 translate-y-[2px] transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
                {totalCount} {t("common.companies")?.toLowerCase()}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("companiesPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          {hasPermission(PERMISSIONS.COMPANIES_CREATE) && (
            <Button
              onClick={() => router.push("/companies/new")}
              className="w-full sm:w-auto h-10 px-4 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("companiesPage.addCompany")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={fetchCompanies}
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
                placeholder={t("companiesPage.searchPlaceholder")}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
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
                  <TableHead className="w-1/6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("code")}>
                    <div className="flex items-center">
                      {t("companiesPage.tableHeaders.code")}
                      {sortConfig?.key === "code" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-1/4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("nameVi")}>
                    <div className="flex items-center">
                      {t("companiesPage.tableHeaders.nameVi")}
                      {sortConfig?.key === "nameVi" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-1/4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("nameEn")}>
                    <div className="flex items-center">
                      {t("companiesPage.tableHeaders.nameEn")}
                      {sortConfig?.key === "nameEn" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-1/6 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("taxCode")}>
                    <div className="flex items-center">
                      {t("companiesPage.tableHeaders.taxCode")}
                      {sortConfig?.key === "taxCode" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-1/4 cursor-pointer hover:bg-muted/50" onClick={() => handleSort("taxAddress")}>
                    <div className="flex items-center">
                      {t("companiesPage.tableHeaders.taxAddress")}
                      {sortConfig?.key === "taxAddress" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-28 text-center">
                    {t("companiesPage.tableHeaders.usersCount")}
                  </TableHead>
                  {showActions && (
                    <TableHead className="w-24 text-center">{t("common.actions")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className={`transition-opacity duration-200 ${isLoading && companies.length > 0 ? "opacity-50" : ""}`}>
                {companies.length > 0 ? (
                  companies.map((company) => {
                    const hasUsers = (company._count?.users ?? 0) > 0;
                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-semibold">{company.code || "-"}</TableCell>
                        <TableCell>{company.nameVi || "-"}</TableCell>
                        <TableCell>{company.nameEn || "-"}</TableCell>
                        <TableCell>{company.taxCode || "-"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]" title={company.taxAddress}>
                          {company.taxAddress || "-"}
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">
                          <Badge variant="secondary" className="px-2.5 py-0.5 font-semibold text-xs bg-muted text-muted-foreground">
                            {company._count?.users ?? 0}
                          </Badge>
                        </TableCell>
                        {showActions && (
                          <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-1">
                              {hasPermission(PERMISSIONS.COMPANIES_READ) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => router.push(`/companies/${company.id}`)}
                                  title={t("companiesPage.viewCompany")}
                                  className="text-zinc-500 hover:text-zinc-600 hover:bg-zinc-500/10"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission(PERMISSIONS.COMPANIES_UPDATE) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => router.push(`/companies/${company.id}/edit`)}
                                  title={t("companiesPage.editCompany")}
                                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission(PERMISSIONS.COMPANIES_DELETE) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(company)}
                                  disabled={hasUsers}
                                  title={
                                    hasUsers
                                      ? t("companiesPage.failedToDeleteHasUsers")
                                      : t("common.delete")
                                  }
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {!isLoading && (search ? t("companiesPage.noCompaniesMatch") : t("companiesPage.noCompaniesFound"))}
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
                {t("companiesPage.showingRecords", { count: companies.length, total: totalCount })}
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

                  {pageNumbers.map((pageNum, index) => (
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
