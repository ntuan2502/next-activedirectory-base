"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, Search, RefreshCw, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { useLanguage } from "@/components/language-provider";
import { PERMISSIONS } from "@/config/permissions";

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
  "auth:login": { label: "Login Success", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  "auth:login_failed": { label: "Login Failed", color: "bg-destructive/10 text-destructive border-destructive/20" },
  "auth:logout": { label: "Logout", color: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20" },
  "ldap:test_connection": { label: "LDAP Connection Test", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  "ldap:sync_data": { label: "LDAP Sync", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  "user:delete": { label: "Delete User", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  "user:update_roles": { label: "Update User Roles", color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  "users:bulk_delete": { label: "Bulk Delete Users", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  "users:bulk_disable": { label: "Bulk Disable Users", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  "users:bulk_enable": { label: "Bulk Enable Users", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  "role:create": { label: "Create Role", color: "bg-teal-500/10 text-teal-500 border-teal-500/20" },
  "role:update": { label: "Update Role", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  "role:delete": { label: "Delete Role", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
};

const getActionTranslationKey = (action: string): string => {
  const mapping: Record<string, string> = {
    "auth:login": "login",
    "auth:login_failed": "loginFailed",
    "auth:logout": "logout",
    "ldap:test_connection": "ldapTest",
    "ldap:sync_data": "ldapSync",
    "user:delete": "deleteUser",
    "user:update_roles": "updateUserRoles",
    "users:bulk_delete": "bulkDelete",
    "users:bulk_disable": "bulkDisable",
    "users:bulk_enable": "bulkEnable",
    "role:create": "createRole",
    "role:update": "updateRole",
    "role:delete": "deleteRole",
  };
  return mapping[action] ? `auditLogsPage.actions.${mapping[action]}` : "";
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters and Pagination State
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog details state
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  // Batch sync navigation inside dialog
  const [selectedBatchUserIndex, setSelectedBatchUserIndex] = useState<number>(0);
  const [batchUserSearch, setBatchUserSearch] = useState<string>("");
  const [prevLogId, setPrevLogId] = useState<string | null>(null);

  if (selectedLog?.id !== prevLogId) {
    setPrevLogId(selectedLog?.id || null);
    setSelectedBatchUserIndex(0);
    setBatchUserSearch("");
  }

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        action: actionFilter,
        search: search.trim(),
      });

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
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, actionFilter, search]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLogs();
    });
  }, [fetchLogs]);


  // Reset page when filter changes
  const handleFilterChange = (val: string) => {
    setActionFilter(val);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const parseDiff = (detailsStr: string | null) => {
    if (!detailsStr) return null;
    try {
      const parsed = JSON.parse(detailsStr);
      if (parsed && typeof parsed === "object" && ("before" in parsed || "after" in parsed)) {
        return parsed as { before: unknown; after: unknown };
      }
      return null;
    } catch {
      return null;
    }
  };

  interface BatchLdapSyncDetail {
    username: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
  }

  const parseBatchLdapSync = (log: AuditLogRecord | null): BatchLdapSyncDetail[] | null => {
    if (!log || log.action !== "ldap:sync_data" || !log.details) return null;
    try {
      const parsed = JSON.parse(log.details);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.details)) {
        return parsed.details as BatchLdapSyncDetail[];
      }
      return null;
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

  const diffData = selectedLog ? parseDiff(selectedLog.details) : null;
  const batchSyncDetails = selectedLog ? parseBatchLdapSync(selectedLog) : null;
  const isBatchSync = !!batchSyncDetails && batchSyncDetails.length > 0;

  const filteredBatchUsers = batchSyncDetails
    ? batchSyncDetails.filter((detail) =>
        detail.username.toLowerCase().includes(batchUserSearch.toLowerCase())
      )
    : [];

  const activeBatchUser = filteredBatchUsers[selectedBatchUserIndex] || filteredBatchUsers[0] || null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              {t("auditLogsPage.title")}
            </CardTitle>
            <CardDescription>
              {t("auditLogsPage.description")}
            </CardDescription>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("auditLogsPage.searchPlaceholder")}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3">
              <select
                value={actionFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="flex h-9 w-full sm:w-[220px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">{t("auditLogsPage.allActivities")}</option>
                <option value="auth:login">{t("auditLogsPage.actions.login")}</option>
                <option value="auth:login_failed">{t("auditLogsPage.actions.loginFailed")}</option>
                <option value="auth:logout">{t("auditLogsPage.actions.logout")}</option>
                <option value="ldap:test_connection">{t("auditLogsPage.actions.ldapTest")}</option>
                <option value="ldap:sync_data">{t("auditLogsPage.actions.ldapSync")}</option>
                <option value="user:delete">{t("auditLogsPage.actions.deleteUser")}</option>
                <option value="user:update_roles">{t("auditLogsPage.actions.updateUserRoles")}</option>
                <option value="users:bulk_delete">{t("auditLogsPage.actions.bulkDelete")}</option>
                <option value="users:bulk_disable">{t("auditLogsPage.actions.bulkDisable")}</option>
                <option value="users:bulk_enable">{t("auditLogsPage.actions.bulkEnable")}</option>
                <option value="role:create">{t("auditLogsPage.actions.createRole")}</option>
                <option value="role:update">{t("auditLogsPage.actions.updateRole")}</option>
                <option value="role:delete">{t("auditLogsPage.actions.deleteRole")}</option>
              </select>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
                }}
                className="flex h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="10">{t("auditLogsPage.rowsPerPage", { count: 10 })}</option>
                <option value="20">{t("auditLogsPage.rowsPerPage", { count: 20 })}</option>
                <option value="50">{t("auditLogsPage.rowsPerPage", { count: 50 })}</option>
                <option value="100">{t("auditLogsPage.rowsPerPage", { count: 100 })}</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[180px]">{t("auditLogsPage.tableHeaders.timestamp")}</TableHead>
                  <TableHead className="w-[200px]">{t("auditLogsPage.tableHeaders.operator")}</TableHead>
                  <TableHead className="w-[200px]">{t("auditLogsPage.tableHeaders.action")}</TableHead>
                  <TableHead>{t("auditLogsPage.tableHeaders.target")}</TableHead>
                  <TableHead className="w-[140px]">{t("auditLogsPage.tableHeaders.ipAddress")}</TableHead>
                  <TableHead className="w-[100px] text-center">{t("auditLogsPage.tableHeaders.details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{log.username}</span>
                          {log.user?.displayName && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {log.user.displayName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={log.target || ""}>
                        {log.target || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedLog(log)}
                          disabled={!log.details}
                          title={log.details ? t("auditLogsPage.viewDetails") : t("auditLogsPage.noDetailAvailable")}
                        >
                          <Eye className={`h-4 w-4 ${log.details ? "text-primary" : "text-muted-foreground/30"}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      {t("auditLogsPage.noRecords")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
              <span className="text-sm text-muted-foreground">
                {t("auditLogsPage.showingRecords", { count: logs.length, total: totalCount })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium px-2">
                  {t("auditLogsPage.pageOf", { page, total: totalPages })}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className={`${isBatchSync ? "lg:max-w-[1000px] md:max-w-[850px]" : "lg:max-w-[850px] md:max-w-[750px]"} sm:max-w-[600px] w-full max-h-[85vh] flex flex-col overflow-hidden`}>
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
                  <span className="font-semibold block mt-0.5">{formatDateTime(selectedLog.createdAt)}</span>
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

              {isBatchSync ? (
                <div className="flex flex-col md:flex-row gap-4 h-[52vh] min-h-0">
                  {/* Left pane: Sync List */}
                  <div className="w-full md:w-1/3 flex flex-col border rounded-lg bg-muted/10 p-3 gap-2 min-h-0">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {t("auditLogsPage.syncedUsersList")} ({batchSyncDetails.length})
                    </span>
                    <Input
                      placeholder={t("auditLogsPage.searchUserPlaceholder")}
                      value={batchUserSearch}
                      onChange={(e) => {
                        setBatchUserSearch(e.target.value);
                        setSelectedBatchUserIndex(0);
                      }}
                      className="h-8 text-xs bg-background"
                    />
                    <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                      {filteredBatchUsers.length > 0 ? (
                        filteredBatchUsers.map((detail) => {
                          const isSelected = activeBatchUser?.username === detail.username;
                          const isCreated = !detail.before;
                          return (
                            <button
                              key={detail.username}
                              onClick={() => {
                                const originalIndex = filteredBatchUsers.indexOf(detail);
                                setSelectedBatchUserIndex(originalIndex !== -1 ? originalIndex : 0);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md transition-colors text-left border ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background hover:bg-muted text-foreground border-border"
                              }`}
                            >
                              <span className="font-mono truncate mr-2">{detail.username}</span>
                              {isCreated ? (
                                <Badge
                                  className={`text-[9px] px-1 py-0 h-4 border ${
                                    isSelected
                                      ? "bg-emerald-600 text-white border-emerald-500"
                                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  }`}
                                >
                                  {t("auditLogsPage.badgeCreated")}
                                </Badge>
                              ) : (
                                <Badge
                                  className={`text-[9px] px-1 py-0 h-4 border ${
                                    isSelected
                                      ? "bg-blue-600 text-white border-blue-500"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  }`}
                                >
                                  {t("auditLogsPage.badgeUpdated")}
                                </Badge>
                              )}
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
                  <div className="flex-1 flex flex-col min-h-0 gap-2">
                    {activeBatchUser ? (
                      <>
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-xs text-muted-foreground">{t("auditLogsPage.comparingChangesFor")}</span>
                          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted">
                            {activeBatchUser.username}
                          </Badge>
                        </div>
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0">
                          {/* Before state */}
                          <div className="flex flex-col min-h-0 h-full">
                            <div className="flex justify-between items-center bg-rose-500/10 px-3 py-1.5 rounded-t-md border border-b-0 border-rose-500/20">
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                {t("auditLogsPage.beforeState")}
                              </span>
                            </div>
                            <pre className="flex-1 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] p-3 rounded-b-md text-xs font-mono overflow-auto border border-rose-500/20 select-all">
                              {activeBatchUser.before
                                ? JSON.stringify(activeBatchUser.before, null, 2)
                                : t("auditLogsPage.noneCreated")}
                            </pre>
                          </div>

                          {/* After state */}
                          <div className="flex flex-col min-h-0 h-full">
                            <div className="flex justify-between items-center bg-emerald-500/10 px-3 py-1.5 rounded-t-md border border-b-0 border-emerald-500/20">
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                {t("auditLogsPage.afterState")}
                              </span>
                            </div>
                            <pre className="flex-1 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] p-3 rounded-b-md text-xs font-mono overflow-auto border border-emerald-500/20 select-all">
                              {activeBatchUser.after
                                ? JSON.stringify(activeBatchUser.after, null, 2)
                                : t("auditLogsPage.noneDeleted")}
                            </pre>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/5 text-muted-foreground text-xs font-medium">
                        {t("auditLogsPage.selectUserToViewDiff")}
                      </div>
                    )}
                  </div>
                </div>
              ) : diffData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Before state */}
                  <div className="space-y-1.5 flex flex-col min-h-0">
                    <div className="flex justify-between items-center bg-rose-500/10 px-3 py-1.5 rounded-t-md border border-b-0 border-rose-500/20">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{t("auditLogsPage.beforeState")}</span>
                    </div>
                    <pre className="flex-1 bg-rose-500/[0.02] dark:bg-rose-500/[0.04] p-4 rounded-b-md text-xs font-mono overflow-auto max-h-[50vh] border border-rose-500/20 select-all">
                      {diffData.before ? JSON.stringify(diffData.before, null, 2) : t("auditLogsPage.noneCreated")}
                    </pre>
                  </div>

                  {/* After state */}
                  <div className="space-y-1.5 flex flex-col min-h-0">
                    <div className="flex justify-between items-center bg-emerald-500/10 px-3 py-1.5 rounded-t-md border border-b-0 border-emerald-500/20">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("auditLogsPage.afterState")}</span>
                    </div>
                    <pre className="flex-1 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04] p-4 rounded-b-md text-xs font-mono overflow-auto max-h-[50vh] border border-emerald-500/20 select-all">
                      {diffData.after ? JSON.stringify(diffData.after, null, 2) : t("auditLogsPage.noneDeleted")}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground block">{t("auditLogsPage.detailData")}</span>
                  <pre className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto max-h-[50vh] border select-all">
                    {selectedLog.details}
                  </pre>
                </div>
              )}
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
