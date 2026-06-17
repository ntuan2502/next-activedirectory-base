"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchDebounce } from "@/hooks/use-search-debounce";
import { ClipboardList, Search, RefreshCw, Eye, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { useLanguage } from "@/components/language-provider";
import { LoadingOverlay } from "@/components/loading-overlay";
import { useSettings } from "@/components/settings-provider";
import { PERMISSIONS } from "@/config/permissions";
import { RowsPerPage } from "@/components/rows-per-page";
import { DEFAULT_LIMIT } from "@/config/constants";
import { getPageNumbers, parseUserAgent, formatRelativeTime, formatDateTimeCustom } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type AuditLogRecord = {
  id: string;
  userId: string | null;
  username: string;
  action: string;
  target: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    displayName: string;
    email: string;
  } | null;
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "auth:login": { label: "Login", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  "auth:logout": { label: "Logout", color: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20" },
  "auth:initial_setup": { label: "Initial Super Admin Setup", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  "ldap:test_connection": { label: "LDAP Connection Test", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  "ldap:fetch_data": { label: "Fetch LDAP Data", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  "ldap:sync_users": { label: "LDAP User Sync", color: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  "ldap:sync_companies": { label: "LDAP Company Sync", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  "user:delete": { label: "Delete User", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  "user:update_roles": { label: "Update User Roles", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  "user:update_profile": { label: "Update Profile", color: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  "user:change_password": { label: "Change Password", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  "user:lock": { label: "Lock User", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "user:unlock": { label: "Unlock User", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  "users:bulk_delete": { label: "Bulk Delete Users", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  "users:bulk_disable": { label: "Bulk Disable Users", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  "users:bulk_enable": { label: "Bulk Enable Users", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  "users:bulk_lock": { label: "Bulk Lock Users", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  "users:bulk_unlock": { label: "Bulk Unlock Users", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  "role:create": { label: "Create Role", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  "role:update": { label: "Update Role", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  "role:delete": { label: "Delete Role", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  "settings:update": { label: "Update Settings", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  "settings:initial_setup_ldap": { label: "Setup Initial LDAP", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  "settings:initial_setup_skip": { label: "Skip Initial LDAP", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "company:create": { label: "Create Company", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  "company:update": { label: "Update Company", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  "company:delete": { label: "Delete Company", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  "user:update_settings": { label: "Update Display Preferences", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  "session:revoke_all": { label: "Revoke All Sessions", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  "session:revoke_other": { label: "Revoke Other Sessions", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "session:revoke_specific": { label: "Revoke Specific Session", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

const getActionTranslationKey = (action: string): string => {
  const mapping: Record<string, string> = {
    "auth:login": "login",
    "auth:logout": "logout",
    "auth:initial_setup": "initialSetup",
    "ldap:test_connection": "ldapTest",
    "ldap:fetch_data": "ldapFetch",
    "ldap:sync_users": "ldapSyncUsers",
    "ldap:sync_companies": "ldapSyncCompanies",
    "user:delete": "deleteUser",
    "user:update_roles": "updateUserRoles",
    "user:update_profile": "updateProfile",
    "user:update_settings": "updateSettings",
    "user:change_password": "changePassword",
    "user:lock": "lockUser",
    "user:unlock": "unlockUser",
    "users:bulk_delete": "bulkDelete",
    "users:bulk_disable": "bulkDisable",
    "users:bulk_enable": "bulkEnable",
    "users:bulk_lock": "bulkLock",
    "users:bulk_unlock": "bulkUnlock",
    "role:create": "createRole",
    "role:update": "updateRole",
    "role:delete": "deleteRole",
    "settings:update": "settingsUpdate",
    "settings:initial_setup_ldap": "initialSetupLdap",
    "settings:initial_setup_skip": "initialSetupSkip",
    "company:create": "createCompany",
    "company:update": "updateCompany",
    "company:delete": "deleteCompany",
    "session:revoke_all": "revokeAllSessions",
    "session:revoke_other": "revokeOtherSessions",
    "session:revoke_specific": "revokeSpecificSession",
  };
  return mapping[action] ? `auditLogsPage.actions.${mapping[action]}` : "";
};


interface DiffViewerProps {
  before: unknown;
  after: unknown;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

function DiffViewer({ before, after, t }: DiffViewerProps) {
  const isBeforeObj = !!before && typeof before === "object" && !Array.isArray(before);
  const isAfterObj = !!after && typeof after === "object" && !Array.isArray(after);

  const isComplex = (val: unknown): boolean => {
    if (!val || typeof val !== "object") return false;
    if (Array.isArray(val)) return true;
    return Object.values(val as Record<string, unknown>).some(
      (v) => v !== null && typeof v === "object"
    );
  };

  const renderValue = (val: unknown) => {
    if (typeof val === "string" && val.includes(".") && !val.includes(" ")) {
      return JSON.stringify(t(val));
    }
    return JSON.stringify(val);
  };

  if (!before && !after) {
    return <div className="p-4 text-muted-foreground">{t("common.noData")}</div>;
  }

  // Case 1: Creation (before is null/undefined)
  if (!before && after) {
    const keys = typeof after === "object" ? Object.keys(after) : [];
    const afterObj = after as Record<string, unknown>;
    const isAfterComplex = isComplex(after);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {/* Before */}
        <div className="flex flex-col border border-rose-500/20 rounded-lg overflow-hidden bg-rose-500/[0.01]">
          <div className="bg-rose-500/10 px-3 py-1.5 border-b border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {t("auditLogsPage.beforeState")}
          </div>
          <div className="p-4 flex-1 font-mono text-xs text-rose-600/70 italic flex items-center justify-center min-h-[120px]">
            {t("auditLogsPage.noneCreated")}
          </div>
        </div>
        {/* After */}
        <div className="flex flex-col border border-emerald-500/20 rounded-lg overflow-hidden bg-emerald-500/[0.01]">
          <div className="bg-emerald-500/10 px-3 py-1.5 border-b border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t("auditLogsPage.afterState")}
          </div>
          {isAfterComplex ? (
            <pre className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] bg-emerald-500/[0.02] text-emerald-700 dark:text-emerald-300 whitespace-pre-wrap break-all flex-1">
              {JSON.stringify(after, null, 2)}
            </pre>
          ) : (
            <div className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] bg-emerald-500/[0.02] space-y-0.5">
              <div className="text-muted-foreground/60">{"{"}</div>
              {keys.map((k) => (
                <div key={k} className="bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 font-mono text-xs break-all whitespace-pre-wrap">
                  &nbsp;&nbsp;&quot;{k}&quot;: {renderValue(afterObj[k])}
                </div>
              ))}
              <div className="text-muted-foreground/60">{"}"}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Case 2: Deletion (after is null/undefined)
  if (before && !after) {
    const keys = typeof before === "object" ? Object.keys(before) : [];
    const beforeObj = before as Record<string, unknown>;
    const isBeforeComplex = isComplex(before);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {/* Before */}
        <div className="flex flex-col border border-rose-500/20 rounded-lg overflow-hidden bg-rose-500/[0.01]">
          <div className="bg-rose-500/10 px-3 py-1.5 border-b border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {t("auditLogsPage.beforeState")}
          </div>
          {isBeforeComplex ? (
            <pre className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] bg-rose-500/[0.02] text-rose-700 dark:text-rose-300 whitespace-pre-wrap break-all flex-1">
              {JSON.stringify(before, null, 2)}
            </pre>
          ) : (
            <div className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] bg-rose-500/[0.02] space-y-0.5">
              <div className="text-muted-foreground/60">{"{"}</div>
              {keys.map((k) => (
                <div key={k} className="bg-rose-500/10 dark:bg-rose-500/20 px-2 py-0.5 rounded text-rose-700 dark:text-rose-300 font-mono text-xs break-all whitespace-pre-wrap">
                  &nbsp;&nbsp;&quot;{k}&quot;: {renderValue(beforeObj[k])}
                </div>
              ))}
              <div className="text-muted-foreground/60">{"}"}</div>
            </div>
          )}
        </div>
        {/* After */}
        <div className="flex flex-col border border-emerald-500/20 rounded-lg overflow-hidden bg-emerald-500/[0.01]">
          <div className="bg-emerald-500/10 px-3 py-1.5 border-b border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {t("auditLogsPage.afterState")}
          </div>
          <div className="p-4 flex-1 font-mono text-xs text-emerald-600/70 italic flex items-center justify-center min-h-[120px]">
            {t("auditLogsPage.noneDeleted")}
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Both exist but are not objects (e.g. primitives, arrays)
  if (!isBeforeObj || !isAfterObj) {
    const beforeStr = typeof before === "string"
      ? (before.includes(".") && !before.includes(" ") ? t(before) : before)
      : JSON.stringify(before, null, 2);
    const afterStr = typeof after === "string"
      ? (after.includes(".") && !after.includes(" ") ? t(after) : after)
      : JSON.stringify(after, null, 2);

    const beforeLines = beforeStr.split("\n");
    const afterLines = afterStr.split("\n");
    const maxLines = Math.max(beforeLines.length, afterLines.length);

    return (
      <div className="flex flex-col border border-muted/50 rounded-lg overflow-hidden flex-1 min-h-0 bg-background w-full">
        {/* Split Header */}
        <div className="grid grid-cols-2 text-xs font-semibold shrink-0 border-b border-muted/30">
          <div className="bg-rose-500/10 px-3 py-1.5 text-rose-600 dark:text-rose-400 border-r border-muted/30">
            {t("auditLogsPage.beforeState")}
          </div>
          <div className="bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
            {t("auditLogsPage.afterState")}
          </div>
        </div>

        {/* Split Content Body */}
        <div className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] flex-1 space-y-0.5 bg-background">
          {Array.from({ length: maxLines }).map((_, i) => {
            const hasBefore = i < beforeLines.length;
            const hasAfter = i < afterLines.length;
            const lineBefore = beforeLines[i];
            const lineAfter = afterLines[i];
            const isLineChanged = !hasBefore || !hasAfter || lineBefore !== lineAfter;

            return (
              <div key={i} className="grid grid-cols-2 gap-4 items-stretch">
                {/* Before Column Cell */}
                <div className="border-r border-muted/20 pr-2 flex flex-col justify-stretch">
                  {!hasBefore ? (
                    <div className="h-full w-full bg-rose-500/[0.03] dark:bg-rose-500/[0.05] rounded min-h-[20px] select-none border border-dashed border-rose-500/10" />
                  ) : (
                    <div
                      className={`px-2 py-0.5 rounded transition-colors font-mono text-xs break-all whitespace-pre-wrap h-full ${isLineChanged
                          ? "bg-rose-500/15 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold"
                          : "text-muted-foreground/85"
                        }`}
                    >
                      {lineBefore}
                    </div>
                  )}
                </div>

                {/* After Column Cell */}
                <div className="pl-2 flex flex-col justify-stretch">
                  {!hasAfter ? (
                    <div className="h-full w-full bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] rounded min-h-[20px] select-none border border-dashed border-emerald-500/10" />
                  ) : (
                    <div
                      className={`px-2 py-0.5 rounded transition-colors font-mono text-xs break-all whitespace-pre-wrap h-full ${isLineChanged
                          ? "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold"
                          : "text-muted-foreground/85"
                        }`}
                    >
                      {lineAfter}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Case 4: Both are objects, line-by-line field comparison
  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const beforeKeys = Object.keys(beforeObj);
  const afterKeys = Object.keys(afterObj);
  const allKeys = [...beforeKeys];
  for (const k of afterKeys) {
    if (!allKeys.includes(k)) {
      allKeys.push(k);
    }
  }

  return (
    <div className="flex flex-col border border-muted/50 rounded-lg overflow-hidden flex-1 min-h-0 bg-background w-full">
      {/* Split Header */}
      <div className="grid grid-cols-2 text-xs font-semibold shrink-0 border-b border-muted/30">
        <div className="bg-rose-500/10 px-3 py-1.5 text-rose-600 dark:text-rose-400 border-r border-muted/30">
          {t("auditLogsPage.beforeState")}
        </div>
        <div className="bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
          {t("auditLogsPage.afterState")}
        </div>
      </div>

      {/* Split Content Body */}
      <div className="p-4 font-mono text-xs overflow-x-hidden overflow-y-auto max-h-[50vh] flex-1 space-y-0.5 bg-background">
        {/* Open bracket row */}
        <div className="grid grid-cols-2 gap-4 border-b border-muted/20 pb-1 mb-1 text-muted-foreground/50 select-none">
          <div className="border-r border-muted/20 pr-2">{"{"}</div>
          <div className="pl-2">{"{"}</div>
        </div>

        {/* Diff lines */}
        {allKeys.map((k) => {
          const hasBefore = k in beforeObj;
          const hasAfter = k in afterObj;
          const valBefore = beforeObj[k];
          const valAfter = afterObj[k];
          const isChanged = !hasBefore || !hasAfter || JSON.stringify(valBefore) !== JSON.stringify(valAfter);

          return (
            <div key={k} className="grid grid-cols-2 gap-4 items-stretch">
              {/* Before Column Cell */}
              <div className="border-r border-muted/20 pr-2 flex flex-col justify-stretch">
                {!hasBefore ? (
                  <div className="h-full w-full bg-rose-500/[0.03] dark:bg-rose-500/[0.05] rounded min-h-[20px] select-none border border-dashed border-rose-500/10" />
                ) : (
                  <div
                    className={`px-2 py-0.5 rounded transition-colors font-mono text-xs break-all whitespace-pre-wrap h-full ${isChanged
                        ? "bg-rose-500/15 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold"
                        : "text-muted-foreground/85"
                      }`}
                  >
                    &nbsp;&nbsp;&quot;{k}&quot;: {renderValue(valBefore)}
                  </div>
                )}
              </div>

              {/* After Column Cell */}
              <div className="pl-2 flex flex-col justify-stretch">
                {!hasAfter ? (
                  <div className="h-full w-full bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] rounded min-h-[20px] select-none border border-dashed border-emerald-500/10" />
                ) : (
                  <div
                    className={`px-2 py-0.5 rounded transition-colors font-mono text-xs break-all whitespace-pre-wrap h-full ${isChanged
                        ? "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-semibold"
                        : "text-muted-foreground/85"
                      }`}
                  >
                    &nbsp;&nbsp;&quot;{k}&quot;: {renderValue(valAfter)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Close bracket row */}
        <div className="grid grid-cols-2 gap-4 border-t border-muted/20 pt-1 mt-1 text-muted-foreground/50 select-none">
          <div className="border-r border-muted/20 pr-2">{"}"}</div>
          <div className="pl-2">{"}"}</div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { dateFormat, timeFormat } = useSettings();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters, Sorting and Pagination State
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Dialog details state
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  // Batch sync navigation inside dialog
  const [selectedBatchUserIndex, setSelectedBatchUserIndex] = useState<number>(0);
  const [batchUserSearch, setBatchUserSearch] = useState<string>("");
  const [prevLogId, setPrevLogId] = useState<string | null>(null);

  const currentLogId = selectedLog?.id || null;
  if (currentLogId !== prevLogId) {
    setPrevLogId(currentLogId);
    setSelectedBatchUserIndex(0);
    setBatchUserSearch("");
  }

  const fetchLogs = useCallback(async () => {
    if (!isReady) return;
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        action: actionFilter,
        search: search.trim(),
      });
      if (sortConfig) {
        queryParams.set("sortBy", sortConfig.key);
        queryParams.set("sortOrder", sortConfig.direction);
      }

      const res = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLogs(data.data);
          setTotalPages(data.pagination.totalPages);
          setTotalCount(data.pagination.totalCount);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, actionFilter, search, sortConfig, isReady]);

  // Load initial state from URL search params on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get("page") || "1", 10);
      const l = parseInt(params.get("limit") || DEFAULT_LIMIT.toString(), 10);
      const a = params.get("action") || "all";
      const s = params.get("search") || "";
      const sb = params.get("sortBy") || "createdAt";
      const so = params.get("sortOrder") || "desc";

      setPage(p);
      setLimit(l);
      setActionFilter(a);
      setLocalSearch(s);
      setSearch(s);
      setSortConfig({ key: sb, direction: so as "asc" | "desc" });
      setIsReady(true);
    });
  }, []);

  // Debounce search query input (1s delay)
  useSearchDebounce({ localSearch, isReady, setSearch, setPage });

  // Fetch logs when states change and page is ready
  useEffect(() => {
    if (!isReady) return;
    Promise.resolve().then(() => {
      fetchLogs();
    });
  }, [fetchLogs, isReady]);

  // Synchronize state changes to URL query string
  useEffect(() => {
    if (!isReady) return;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (limit !== DEFAULT_LIMIT) params.set("limit", limit.toString());
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (search.trim()) params.set("search", search.trim());
    if (sortConfig) {
      params.set("sortBy", sortConfig.key);
      params.set("sortOrder", sortConfig.direction);
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, [page, limit, actionFilter, search, sortConfig, isReady]);

  // Listen to real-time audit log creations via SSE Custom Event
  useEffect(() => {
    const handleNewLog = (e: Event) => {
      const customEvent = e as CustomEvent<AuditLogRecord>;
      const newLog = customEvent.detail;

      // Filter check: Action
      if (actionFilter !== "all" && newLog.action !== actionFilter) {
        return;
      }
      // Filter check: Search Query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matches =
          newLog.username.toLowerCase().includes(query) ||
          (newLog.target && newLog.target.toLowerCase().includes(query)) ||
          (newLog.details && newLog.details.toLowerCase().includes(query));
        if (!matches) return;
      }

      // Increment totalCount count
      setTotalCount((c) => c + 1);

      // Only insert to list in real-time if we are on the first page
      if (page === 1) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === newLog.id)) {
            return prev;
          }
          const updated = [newLog, ...prev];
          if (updated.length > limit) {
            updated.pop();
          }
          return updated;
        });
      }
    };

    window.addEventListener("audit_log_created_event", handleNewLog);
    return () => {
      window.removeEventListener("audit_log_created_event", handleNewLog);
    };
  }, [page, actionFilter, search, limit]);

  // Reset page when filter changes
  const handleFilterChange = (val: string) => {
    setActionFilter(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" }; // default desc for audit logs (newest first)
    });
    setPage(1);
  };



  const getTargetTranslation = (target: string | null) => {
    if (!target) return "-";
    return target;
  };

  const formatDateTime = (dateStr: string) => {
    return formatDateTimeCustom(dateStr, dateFormat, timeFormat, locale);
  };

  const parseDiff = (log: AuditLogRecord) => {
    if (!log.details) return null;
    try {
      const parsed = JSON.parse(log.details);
      if (parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object") {
        const data = parsed.data as Record<string, unknown>;
        if ("before" in data || "after" in data) {
          return data as { before: unknown; after: unknown };
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  interface BatchSyncItem {
    id: string;
    type: "user" | "company";
    name: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
  }

  const parseBatchLdapSync = (log: AuditLogRecord | null): BatchSyncItem[] | null => {
    if (!log || !log.details) return null;
    try {
      const parsed = JSON.parse(log.details);
      if (!parsed || typeof parsed !== "object" || parsed.status !== "success" || !parsed.data) return null;
      const data = parsed.data as Record<string, unknown>;
      const items: BatchSyncItem[] = [];

      // Phân tích danh sách user đồng bộ hoặc khóa/mở khóa hàng loạt
      if (["ldap:sync_users", "users:bulk_lock", "users:bulk_unlock"].includes(log.action) && Array.isArray(data.details)) {
        for (const detail of data.details) {
          if (detail && typeof detail === "object" && "username" in detail) {
            const uDetail = detail as {
              username: string;
              before: Record<string, unknown> | null;
              after: Record<string, unknown>;
            };
            items.push({
              id: `user-${uDetail.username}`,
              type: "user",
              name: uDetail.username,
              before: uDetail.before,
              after: uDetail.after,
            });
          }
        }
      }

      // Phân tích danh sách công ty đồng bộ
      if (log.action === "ldap:sync_companies" && Array.isArray(data.companies)) {
        for (const comp of data.companies) {
          if (comp && typeof comp === "object" && "code" in comp) {
            const cDetail = comp as {
              code: string;
              before: Record<string, unknown> | null;
              after: Record<string, unknown>;
            };
            items.push({
              id: `company-${cDetail.code}`,
              type: "company",
              name: cDetail.code,
              before: cDetail.before,
              after: cDetail.after,
            });
          }
        }
      }

      return items.length > 0 ? items : null;
    } catch {
      return null;
    }
  };

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: "bg-muted text-muted-foreground border-muted-foreground/20" };
    const translationKey = getActionTranslationKey(action);
    const label = translationKey ? t(translationKey) : config.label;
    return (
      <Badge variant="outline" className={`${config.color} font-medium`}>
        {label}
      </Badge>
    );
  };

  if (!hasPermission(PERMISSIONS.AUDIT_LOGS_READ)) {
    return <AccessDenied />;
  }

  const diffData = selectedLog ? parseDiff(selectedLog) : null;
  const batchSyncDetails = selectedLog ? parseBatchLdapSync(selectedLog) : null;
  const isBatchSync = !!batchSyncDetails && batchSyncDetails.length > 0;

  // Trích xuất status, message và data từ details để hiển thị dạng Thông báo riêng
  const logDetailsParsed = (() => {
    if (!selectedLog || !selectedLog.details) return null;
    try {
      const parsed = JSON.parse(selectedLog.details);
      if (parsed && typeof parsed === "object") {
        const status = parsed.status === "failed" ? "failed" : "success";
        const message = parsed.message
          ? (parsed.message.includes(".") && !parsed.message.includes(" ") ? t(parsed.message) : parsed.message)
          : "";
        return {
          status,
          message,
          data: parsed.data,
        };
      }
      return null;
    } catch {
      return {
        status: "success" as const,
        message: selectedLog.details,
        data: null,
      };
    }
  })();


  const filteredBatchItems = (batchSyncDetails || []).filter((item) =>
    item.name.toLowerCase().includes(batchUserSearch.toLowerCase())
  );

  const activeBatchItem = filteredBatchItems[selectedBatchUserIndex] || filteredBatchItems[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-primary" />
            {t("auditLogsPage.title")}
            {(totalCount > 0 || !isLoading) && (
              <Badge variant="secondary" className={`ml-2 translate-y-[2px] transition-opacity duration-200 ${isLoading ? "opacity-50" : ""}`}>
                {totalCount} {t("common.auditLogs").toLowerCase()}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("auditLogsPage.description")}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={fetchLogs}
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
                placeholder={t("auditLogsPage.searchPlaceholder")}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <div className="relative w-full sm:w-[220px]">
                <select
                  value={actionFilter}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="w-full h-8 pl-3 pr-8 rounded-lg border border-border bg-card hover:bg-muted/10 font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer appearance-none text-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="all">{t("auditLogsPage.allActivities")}</option>
                  <option value="auth:login">{t("auditLogsPage.actions.login")}</option>
                  <option value="auth:logout">{t("auditLogsPage.actions.logout")}</option>
                  <option value="auth:initial_setup">{t("auditLogsPage.actions.initialSetup")}</option>
                  <option value="session:revoke_all">{t("auditLogsPage.actions.revokeAllSessions")}</option>
                  <option value="session:revoke_other">{t("auditLogsPage.actions.revokeOtherSessions")}</option>
                  <option value="session:revoke_specific">{t("auditLogsPage.actions.revokeSpecificSession")}</option>
                  <option value="ldap:test_connection">{t("auditLogsPage.actions.ldapTest")}</option>
                  <option value="ldap:sync_users">{t("auditLogsPage.actions.ldapSyncUsers")}</option>
                  <option value="ldap:sync_companies">{t("auditLogsPage.actions.ldapSyncCompanies")}</option>
                  <option value="user:delete">{t("auditLogsPage.actions.deleteUser")}</option>
                  <option value="user:update_roles">{t("auditLogsPage.actions.updateUserRoles")}</option>
                  <option value="user:update_profile">{t("auditLogsPage.actions.updateProfile")}</option>
                  <option value="user:update_settings">{t("auditLogsPage.actions.updateSettings")}</option>
                  <option value="user:change_password">{t("auditLogsPage.actions.changePassword")}</option>
                  <option value="users:bulk_delete">{t("auditLogsPage.actions.bulkDelete")}</option>
                  <option value="users:bulk_disable">{t("auditLogsPage.actions.bulkDisable")}</option>
                  <option value="users:bulk_enable">{t("auditLogsPage.actions.bulkEnable")}</option>
                  <option value="role:create">{t("auditLogsPage.actions.createRole")}</option>
                  <option value="role:update">{t("auditLogsPage.actions.updateRole")}</option>
                  <option value="role:delete">{t("auditLogsPage.actions.deleteRole")}</option>
                  <option value="settings:update">{t("auditLogsPage.actions.settingsUpdate")}</option>
                  <option value="settings:initial_setup_ldap">{t("auditLogsPage.actions.initialSetupLdap")}</option>
                  <option value="settings:initial_setup_skip">{t("auditLogsPage.actions.initialSetupSkip")}</option>
                  <option value="company:create">{t("auditLogsPage.actions.createCompany")}</option>
                  <option value="company:update">{t("auditLogsPage.actions.updateCompany")}</option>
                  <option value="company:delete">{t("auditLogsPage.actions.deleteCompany")}</option>
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

          {/* Logs Table */}
          <div className="overflow-x-auto relative mb-0">
            <LoadingOverlay show={isLoading} variant="table" />
            <Table wrapperClassName="mb-0" className="mb-0">
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("createdAt")}>
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.timestamp")}
                      {sortConfig?.key === "createdAt" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[200px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("username")}>
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.operator")}
                      {sortConfig?.key === "username" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[200px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("action")}>
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.action")}
                      {sortConfig?.key === "action" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[130px]">
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.status")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("target")}>
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.target")}
                      {sortConfig?.key === "target" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[320px]">
                    <div className="flex items-center">
                      {t("auditLogsPage.notification")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort("ipAddress")}>
                    <div className="flex items-center">
                      {t("auditLogsPage.tableHeaders.ipAddress")}
                      {sortConfig?.key === "ipAddress" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] text-center">{t("auditLogsPage.tableHeaders.details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={`transition-opacity duration-200 ${isLoading && logs.length > 0 ? "opacity-50" : ""}`}>
                {logs.length > 0 ? (
                  logs.map((log) => {
                    let isFailed = false;
                    try {
                      if (log.details) {
                        const parsed = JSON.parse(log.details);
                        isFailed = parsed?.status === "failed";
                      }
                    } catch { /* empty */ }

                    return (
                      <TableRow
                        key={log.id}
                        className={isFailed
                          ? "bg-destructive/[0.03] dark:bg-destructive/[0.05] hover:bg-destructive/[0.06] dark:hover:bg-destructive/[0.08] border-l-2 border-l-destructive"
                          : "border-l-2 border-l-transparent"
                        }
                      >
                        <TableCell className="text-muted-foreground text-xs">
                          <div className="flex flex-col font-mono min-h-[2.5rem] justify-center">
                            <span className="font-semibold text-foreground">
                              {formatRelativeTime(log.createdAt, locale)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({formatDateTime(log.createdAt)})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col min-h-[2.5rem] justify-center">
                            <span>{log.username}</span>
                            {log.user?.displayName && (
                              <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[180px]">
                                {log.user.displayName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5 min-h-[2.5rem]">
                            {getActionBadge(log.action)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center min-h-[2.5rem]">
                            {(() => {
                              try {
                                if (log.details) {
                                  const parsed = JSON.parse(log.details);
                                  if (parsed && typeof parsed === "object" && "status" in parsed) {
                                    const status = parsed.status;
                                    if (status === "success") {
                                      return (
                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-semibold h-5 px-1.5 shrink-0">
                                          {t("auditLogsPage.targets.success")}
                                        </Badge>
                                      );
                                    } else if (status === "failed") {
                                      return (
                                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-semibold h-5 px-1.5 shrink-0">
                                          {t("auditLogsPage.targets.failed")}
                                        </Badge>
                                      );
                                    }
                                  }
                                }
                              } catch { /* empty */ }
                              return <span className="text-muted-foreground">-</span>;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="w-[180px] max-w-[180px] text-sm">
                          <div className="flex flex-col min-h-[2.5rem] justify-center">
                            {["ldap:sync_users", "ldap:sync_companies", "users:bulk_lock", "users:bulk_unlock"].includes(log.action) ? (() => {
                              try {
                                if (!log.details) return "-";
                                const parsed = JSON.parse(log.details);
                                if (!parsed || typeof parsed !== "object" || parsed.status !== "success" || !parsed.data) return "-";
                                const data = parsed.data as {
                                  createdCount?: number;
                                  updatedCount?: number;
                                  count?: number;
                                };

                                if (log.action === "ldap:sync_users") {
                                  const created = data.createdCount || 0;
                                  const updated = data.updatedCount || 0;
                                  const noChange = created === 0 && updated === 0;
                                  if (noChange) {
                                    return (
                                      <span className="font-semibold truncate max-w-[160px]">
                                        {t("auditLogsPage.syncNoChanges")}
                                      </span>
                                    );
                                  }
                                  const parts = [];
                                  if (created > 0) {
                                    parts.push(t("auditLogsPage.syncUserCreated", { count: created }));
                                  }
                                  if (updated > 0) {
                                    parts.push(t("auditLogsPage.syncUserUpdated", { count: updated }));
                                  }
                                  return (
                                    <span className="font-semibold truncate max-w-[160px]">
                                      {parts.join(", ")}
                                    </span>
                                  );
                                } else if (log.action === "ldap:sync_companies") {
                                  const count = data.count || 0;
                                  return (
                                    <span className="font-semibold truncate max-w-[160px]">
                                      {t("auditLogsPage.syncCompanyCreated", { count })}
                                    </span>
                                  );
                                } else if (log.action === "users:bulk_lock") {
                                  const count = data.count || 0;
                                  return (
                                    <span className="font-semibold truncate max-w-[160px]">
                                      {t("auditLogsPage.bulkLockUsersSuccessCount", { count })}
                                    </span>
                                  );
                                } else if (log.action === "users:bulk_unlock") {
                                  const count = data.count || 0;
                                  return (
                                    <span className="font-semibold truncate max-w-[160px]">
                                      {t("auditLogsPage.bulkUnlockUsersSuccessCount", { count })}
                                    </span>
                                  );
                                }
                              } catch { /* empty */ }
                              return "-";
                            })() : (
                              <>
                                <span className="font-semibold truncate max-w-[160px]">{getTargetTranslation(log.target)}</span>
                                {["auth:login", "auth:logout"].includes(log.action) && log.details && (() => {
                                  try {
                                    const detailsObj = JSON.parse(log.details!);
                                    const ua = detailsObj?.data?.session?.userAgent || detailsObj?.data?.before?.userAgent;
                                    const { browser, os } = ua ? parseUserAgent(ua) : { browser: "", os: "" };
                                    if (browser && os) {
                                      return (
                                        <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[160px]">
                                          {browser} on {os}
                                        </span>
                                      );
                                    }
                                  } catch { /* empty */ }
                                  return null;
                                })()}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[500px] text-sm">
                          <div className="flex items-center min-h-[2.5rem] truncate">
                            {(() => {
                              if (!log.details) return "-";
                              try {
                                const parsed = JSON.parse(log.details);
                                if (parsed && typeof parsed === "object" && parsed.message) {
                                  return parsed.message.includes(".") && !parsed.message.includes(" ")
                                    ? t(parsed.message)
                                    : parsed.message;
                                }
                                return "-";
                              } catch {
                                return "-";
                              }
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          <div className="flex items-center min-h-[2.5rem]">
                            {log.ipAddress || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center min-h-[2.5rem]">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedLog(log)}
                              disabled={!log.details}
                              title={log.details ? t("auditLogsPage.viewDetails") : t("auditLogsPage.noDetailAvailable")}
                            >
                              <Eye className={`h-4 w-4 ${log.details ? "text-primary" : "text-muted-foreground/30"}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      {!isLoading && t("auditLogsPage.noRecords")}
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
                {t("auditLogsPage.showingRecords", { count: logs.length, total: totalCount })}
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

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-7xl w-full max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              {t("auditLogsPage.dialogTitle")}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2 text-sm min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs text-muted-foreground block">{t("auditLogsPage.tableHeaders.action")}</span>
                  <span className="font-semibold block mt-0.5">
                    {getActionTranslationKey(selectedLog.action) ? t(getActionTranslationKey(selectedLog.action)) : (ACTION_LABELS[selectedLog.action]?.label || selectedLog.action)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t("auditLogsPage.tableHeaders.timestamp")}</span>
                  <span className="font-semibold block mt-0.5">
                    {formatRelativeTime(selectedLog.createdAt, locale)} ({formatDateTime(selectedLog.createdAt)})
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t("auditLogsPage.tableHeaders.operator")}</span>
                  <span className="font-semibold block mt-0.5">{selectedLog.username}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">{t("auditLogsPage.tableHeaders.ipAddress")}</span>
                  <span className="font-semibold block mt-0.5">{selectedLog.ipAddress || "-"}</span>
                </div>
              </div>

              {/* Phần Thông báo (luôn hiển thị trên cùng nếu có message) */}
              {logDetailsParsed && logDetailsParsed.message && (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">
                    {t("auditLogsPage.notification")}
                  </span>
                  <div className={`p-3 rounded-lg border text-sm font-medium whitespace-pre-wrap ${logDetailsParsed.status === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}>
                    {logDetailsParsed.message}
                  </div>
                </div>
              )}

              {/* Các phần chi tiết cấu trúc khác ở bên dưới */}
              {isBatchSync ? (
                <div className="flex flex-col md:flex-row gap-4 min-h-0 md:h-[55vh]">
                  {/* Left pane: Sync List */}
                  <div className="w-full md:w-1/3 flex flex-col border rounded-lg bg-muted/10 p-3 gap-2 min-h-0 md:overflow-hidden max-h-[45vh] md:max-h-none">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1 shrink-0">
                      {(() => {
                        if (selectedLog.action === "ldap:sync_companies") return t("auditLogsPage.actions.ldapSyncCompanies");
                        if (selectedLog.action === "users:bulk_lock") return t("auditLogsPage.actions.bulkLock");
                        if (selectedLog.action === "users:bulk_unlock") return t("auditLogsPage.actions.bulkUnlock");
                        return t("auditLogsPage.actions.ldapSyncUsers");
                      })()} ({batchSyncDetails.length})
                    </span>
                    <Input
                      placeholder={
                        selectedLog.action === "ldap:sync_companies"
                          ? `${t("common.search")} ${t("auditLogsPage.badgeCompany").toLowerCase()}...`
                          : t("auditLogsPage.searchUserPlaceholder")
                      }
                      value={batchUserSearch}
                      onChange={(e) => {
                        setBatchUserSearch(e.target.value);
                        setSelectedBatchUserIndex(0);
                      }}
                      className="h-8 text-xs bg-background"
                    />
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                      {filteredBatchItems.length > 0 ? (
                        filteredBatchItems.map((item) => {
                          const isSelected = activeBatchItem?.id === item.id;
                          const isCreated = !item.before;

                          let statusBadgeText = "";
                          let statusBadgeClass = "";

                          if (selectedLog.action === "users:bulk_lock") {
                            statusBadgeText = t("usersPage.status.disabled");
                            statusBadgeClass = isSelected
                              ? "bg-amber-600 text-white border-amber-500"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20";
                          } else if (selectedLog.action === "users:bulk_unlock") {
                            statusBadgeText = t("usersPage.status.active");
                            statusBadgeClass = isSelected
                              ? "bg-green-600 text-white border-green-500"
                              : "bg-green-500/10 text-green-600 border-green-500/20";
                          } else {
                            statusBadgeText = isCreated ? t("auditLogsPage.badgeCreated") : t("auditLogsPage.badgeUpdated");
                            statusBadgeClass = isCreated
                              ? (isSelected ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")
                              : (isSelected ? "bg-blue-600 text-white border-blue-500" : "bg-blue-500/10 text-blue-600 border-blue-500/20");
                          }

                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                const originalIndex = filteredBatchItems.indexOf(item);
                                setSelectedBatchUserIndex(originalIndex !== -1 ? originalIndex : 0);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-colors text-left border ${isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted text-foreground border-border"
                                }`}
                            >
                              <span className="font-mono truncate mr-2">{item.name}</span>
                              <Badge className={`text-[9px] px-1 py-0 h-4 border shrink-0 ${statusBadgeClass}`}>
                                {statusBadgeText}
                              </Badge>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground font-medium">
                          {t("common.noData")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right pane: Side-by-side Diff */}
                  <div className="flex-1 flex flex-col min-h-0 gap-2 md:overflow-hidden min-h-[40vh] md:min-h-0">
                    {activeBatchItem ? (
                      <>
                        <div className="flex items-center gap-2 px-1 shrink-0">
                          <span className="text-xs text-muted-foreground">{t("auditLogsPage.comparingChangesFor")}</span>
                          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted">
                            {activeBatchItem.name}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 h-4 ${activeBatchItem.type === "company"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                              }`}
                          >
                            {t(`auditLogsPage.badge${activeBatchItem.type === "company" ? "Company" : "User"}`)}
                          </Badge>
                        </div>
                        <DiffViewer before={activeBatchItem.before} after={activeBatchItem.after} t={t} />
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/5 text-muted-foreground text-xs font-medium min-h-[120px]">
                        {selectedLog.action === "ldap:sync_companies"
                          ? t("auditLogsPage.selectCompanyToViewDiff")
                          : t("auditLogsPage.selectUserToViewDiff")
                        }
                      </div>
                    )}
                  </div>
                </div>
              ) : diffData ? (
                <DiffViewer before={diffData.before} after={diffData.after} t={t} />
              ) : logDetailsParsed && logDetailsParsed.data !== null && logDetailsParsed.data !== undefined ? (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block font-semibold uppercase tracking-wider">{t("auditLogsPage.detailData")}</span>
                  <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto max-h-[50vh] border whitespace-pre-wrap">
                    {JSON.stringify(logDetailsParsed.data, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setSelectedLog(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
