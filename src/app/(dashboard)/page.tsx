"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Server,
  Users,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  User,
  Activity,
  BarChart3,
  PieChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

type ApiErrorResponse = {
  error: string;
};

type TestSuccessResponse = {
  success: boolean;
  message: string;
};

type SyncSuccessResponse = {
  success: boolean;
  syncedCount: number;
};

type LdapUserPreview = {
  username: string;
  displayName: string;
  email: string;
  department: string;
  company: string;
  title: string;
};

type DashboardStats = {
  syncOverview: {
    total: number;
    active: number;
    disabled: number;
    local: number;
  };
  departments: Array<{ name: string; count: number }>;
  activity: Array<{ date: string; label: string; count: number }>;
};

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && "error" in data;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  const isSyncableUser = (u: LdapUserPreview) => {
    const hasEmail = u.email && u.email.trim() !== "";
    const isTest = u.username.toLowerCase().includes("test") ||
      u.displayName.toLowerCase().includes("test") ||
      (u.email || "").toLowerCase().includes("test");
    return !!(hasEmail && !isTest);
  };

  // Stats State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Connection/Sync actions Loading States
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<LdapUserPreview[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setStats(result.data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchStats());
  }, []);

  const handleTestConnection = async () => {
    setIsTestLoading(true);
    try {
      const res = await fetch("/api/ldap/test", { method: "POST" });
      const data: TestSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "message" in data) {
        toast.success(t("dashboard.successTest"));
      } else if (isApiError(data)) {
        toast.error(data.error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("common.networkError");
      toast.error(message);
    } finally {
      setIsTestLoading(false);
    }
  };

  const fetchPreview = async () => {
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
  };

  const handleOpenSyncDialog = (open: boolean) => {
    setIsSyncDialogOpen(open);
    if (open) {
      fetchPreview();
    }
  };

  const filteredPreviewUsers = useMemo(() => {
    const q = search.toLowerCase();
    return previewUsers.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      (u.company || "").toLowerCase().includes(q) ||
      (u.title || "").toLowerCase().includes(q)
    );
  }, [previewUsers, search]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsernames(new Set(filteredPreviewUsers.filter(u => isSyncableUser(u)).map(u => u.username)));
    } else {
      setSelectedUsernames(new Set());
    }
  };

  const toggleSelectUser = (username: string, checked: boolean) => {
    const newSet = new Set(selectedUsernames);
    if (checked) {
      newSet.add(username);
    } else {
      newSet.delete(username);
    }
    setSelectedUsernames(newSet);
  };

  const handleConfirmSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/ldap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernamesToSync: Array.from(selectedUsernames) }),
      });
      const data: SyncSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "syncedCount" in data) {
        toast.success(t("dashboard.successSync", { count: data.syncedCount }));
        setIsSyncDialogOpen(false);
        // Reload dashboard stats to update charts immediately
        fetchStats();
      } else if (isApiError(data)) {
        toast.error(data.error);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("common.networkError");
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const [sortConfig, setSortConfig] = useState<{ key: keyof LdapUserPreview; direction: "asc" | "desc" } | null>(null);

  const handleSort = (key: keyof LdapUserPreview) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedPreviewUsers = useMemo(() => {
    if (!sortConfig) return filteredPreviewUsers;
    return [...filteredPreviewUsers].sort((a, b) => {
      const aValue = a[sortConfig.key] || "";
      const bValue = b[sortConfig.key] || "";

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredPreviewUsers, sortConfig]);

  const syncableUsersCount = filteredPreviewUsers.filter(u => isSyncableUser(u)).length;

  // Donut Chart logic calculations
  const donutSegments = useMemo(() => {
    if (!stats) return [];
    const { active, disabled, local } = stats.syncOverview;
    const total = active + disabled + local;
    if (total === 0) return [];

    const segments = [
      { key: "active", value: active, strokeClass: "stroke-emerald-500", fillClass: "bg-emerald-500", label: t("dashboardCharts.syncedUsers") },
      { key: "local", value: local, strokeClass: "stroke-amber-500", fillClass: "bg-amber-500", label: t("dashboardCharts.pendingUsers") },
      { key: "disabled", value: disabled, strokeClass: "stroke-rose-500", fillClass: "bg-rose-500", label: t("dashboardCharts.disabledUsers") },
    ].filter(s => s.value > 0);

    let accumulatedPercent = 0;
    return segments.map((seg) => {
      const percent = seg.value / total;
      const strokeDasharray = `${percent * 226.2} 226.2`;
      const strokeDashoffset = -accumulatedPercent * 226.2;
      accumulatedPercent += percent;
      return {
        ...seg,
        strokeDasharray,
        strokeDashoffset,
        percentage: Math.round(percent * 100)
      };
    });
  }, [stats, t]);

  // Horizontal Bar Chart max calculation
  const barChartMax = useMemo(() => {
    if (!stats || stats.departments.length === 0) return 0;
    return Math.max(...stats.departments.map(d => d.count));
  }, [stats]);

  // Area Chart coordinates calculations
  const areaChartPoints = useMemo(() => {
    if (!stats || stats.activity.length === 0) return { points: [], linePath: "", areaPath: "", maxLogs: 0 };
    const maxLogs = Math.max(...stats.activity.map(a => a.count), 5);
    const points = stats.activity.map((act, i) => {
      const x = i * 75 + 25;
      const y = 160 - (maxLogs > 0 ? (act.count / maxLogs) * 130 : 0);
      return { x, y, ...act };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} 160 L ${points[0].x} 160 Z`
      : "";

    return { points, linePath, areaPath, maxLogs };
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header and Control Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Server className="w-8 h-8 text-primary" />
            {t("common.dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("dashboard.signedInAs")} <span className="font-semibold text-foreground">{user?.username}</span>
          </p>
        </div>
        <div className="flex gap-3">
          {hasPermission(PERMISSIONS.LDAP_TEST) && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTestLoading}
              className="h-10 px-4 font-semibold"
            >
              {isTestLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
              {isTestLoading ? t("dashboard.testingConnection") : t("dashboard.testConnection")}
            </Button>
          )}

          {hasPermission(PERMISSIONS.LDAP_SYNC) && (
            <>
              <Button onClick={() => handleOpenSyncDialog(true)} className="h-10 px-4 font-semibold bg-primary text-primary-foreground hover:bg-primary/95">
                <Users className="w-4 h-4 mr-2" />
                {t("dashboard.syncData")}
              </Button>
              <Dialog open={isSyncDialogOpen} onOpenChange={handleOpenSyncDialog}>
                <DialogContent className="max-w-[90vw] sm:max-w-7xl w-full max-h-[85vh] flex flex-col p-4 md:p-6 overflow-hidden">
                  <DialogHeader className="shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <DialogTitle className="flex items-center gap-2">
                        {t("dashboard.syncPreviewTitle")}
                        {!isPreviewLoading && (
                          <Badge variant="secondary">{filteredPreviewUsers.length} {t("common.users").toLowerCase()}</Badge>
                        )}
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        {t("dashboard.syncPreviewDesc")}
                      </DialogDescription>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                      <Input
                        placeholder={t("dashboard.searchPlaceholder")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
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
                        {search ? t("dashboard.noUsersMatch") : t("dashboard.noUsersFound")}
                      </div>
                    ) : (
                      <div className="border rounded-md flex-1 overflow-hidden flex flex-col">
                        <Table wrapperClassName="max-h-[60vh]">
                          <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                            <TableRow>
                              <TableHead className="w-12 text-center">
                                <Checkbox
                                  checked={selectedUsernames.size === syncableUsersCount && syncableUsersCount > 0}
                                  onCheckedChange={toggleSelectAll}
                                  aria-label="Select all"
                                  disabled={syncableUsersCount === 0}
                                />
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("username")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.username")}
                                  {sortConfig?.key === "username" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("displayName")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.displayName")}
                                  {sortConfig?.key === "displayName" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("email")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.email")}
                                  {sortConfig?.key === "email" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("title")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.title")}
                                  {sortConfig?.key === "title" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("department")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.department")}
                                  {sortConfig?.key === "department" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                              <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("company")}>
                                <div className="flex items-center">
                                  {t("dashboard.tableHeaders.company")}
                                  {sortConfig?.key === "company" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                </div>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedPreviewUsers.map((u) => {
                              const hasEmail = u.email && u.email.trim() !== "";
                              const isTest = u.username.toLowerCase().includes("test") ||
                                u.displayName.toLowerCase().includes("test") ||
                                (u.email || "").toLowerCase().includes("test");
                              const isSyncable = hasEmail && !isTest;
                              return (
                                <TableRow key={u.username} className={!isSyncable ? "opacity-60 bg-muted/20" : ""}>
                                  <TableCell className="w-12 text-center">
                                    <Checkbox
                                      checked={selectedUsernames.has(u.username)}
                                      onCheckedChange={(checked) => toggleSelectUser(u.username, !!checked)}
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
                                            {t("dashboard.testAccount")}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-destructive text-xs font-semibold">{t("dashboard.missingEmail")}</span>
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
                        {t("dashboard.validUsersSelected", { selected: selectedUsernames.size, total: syncableUsersCount })}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>{t("common.cancel")}</Button>
                        <Button
                          onClick={handleConfirmSync}
                          disabled={isSyncing || selectedUsernames.size === 0}
                          className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold"
                        >
                          {isSyncing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                          {isSyncing ? t("dashboard.syncing") : t("dashboard.confirmSync")}
                        </Button>
                      </div>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

        {/* 1. Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-md border-muted/50 hover:border-primary/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("common.users")}</span>
              <Users className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight">{stats?.syncOverview.total}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tổng tài khoản trong hệ thống</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-emerald-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.syncedUsers")}</span>
              <UserCheck className="w-5 h-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-emerald-500">{stats?.syncOverview.active}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tài khoản Active Directory đang hoạt động</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-rose-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.disabledUsers")}</span>
              <UserX className="w-5 h-5 text-rose-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-rose-500">{stats?.syncOverview.disabled}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tài khoản Active Directory bị vô hiệu hóa</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-muted/50 hover:border-amber-500/20 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("dashboardCharts.pendingUsers")}</span>
              <User className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              {isStatsLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
              ) : (
                <>
                  <div className="text-3xl font-extrabold tracking-tight text-amber-500">{stats?.syncOverview.local}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tài khoản quản trị tạo trực tiếp cục bộ</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 2. Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Donut Chart (Overview) */}
          <Card className="lg:col-span-2 shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                {t("dashboardCharts.syncOverview")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : donutSegments.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
                  {t("dashboardCharts.noData")}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-64">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.key}
                          cx="50"
                          cy="50"
                          r="36"
                          fill="transparent"
                          className={`${seg.strokeClass} transition-all duration-300 hover:stroke-[12px] cursor-pointer`}
                          strokeWidth="9"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          transform="rotate(-90 50 50)"
                        />
                      ))}
                      <circle cx="50" cy="50" r="30" className="fill-background" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-extrabold">{stats?.syncOverview.total}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tổng User</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3.5 w-full sm:w-auto">
                    {donutSegments.map((seg) => (
                      <div key={seg.key} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3.5 h-3.5 rounded-sm ${seg.fillClass}`} />
                          <span className="font-semibold text-muted-foreground">{seg.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{seg.value}</span>
                          <span className="text-xs text-muted-foreground ml-1">({seg.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Horizontal Bar Chart (Departments) */}
          <Card className="lg:col-span-3 shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {t("dashboardCharts.deptBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats?.departments.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground font-medium">
                  {t("dashboardCharts.noData")}
                </div>
              ) : (
                <div className="space-y-4 h-64 flex flex-col justify-center">
                  {stats?.departments.map((dept) => {
                    const pct = barChartMax > 0 ? (dept.count / barChartMax) * 100 : 0;
                    return (
                      <div key={dept.name} className="space-y-1 group">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-muted-foreground truncate max-w-[80%]">{dept.name}</span>
                          <span className="font-bold text-foreground">{dept.count}</span>
                        </div>
                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-500 ease-out group-hover:scale-y-110 cursor-pointer"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Area Chart (Activity Logs 7 Days) */}
          <Card className="lg:col-span-5 shadow-lg border-muted/60">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                {t("dashboardCharts.activityTimeline")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isStatsLoading ? (
                <div className="flex items-center justify-center h-52">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats?.activity.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground font-medium">
                  {t("dashboardCharts.noData")}
                </div>
              ) : (
                <div className="w-full">
                  <svg viewBox="0 0 500 200" className="w-full h-48 md:h-60 overflow-visible">
                    <defs>
                      <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                      const yVal = 160 - ratio * 130;
                      const gridLabel = Math.round(ratio * areaChartPoints.maxLogs);
                      return (
                        <g key={idx} className="opacity-15 dark:opacity-10">
                          <line x1="20" y1={yVal} x2="485" y2={yVal} stroke="currentColor" strokeDasharray="3 3" />
                          <text x="12" y={yVal + 3} className="text-[10px] font-bold fill-current" textAnchor="end">{gridLabel}</text>
                        </g>
                      );
                    })}

                    {/* Area path */}
                    {areaChartPoints.areaPath && (
                      <path d={areaChartPoints.areaPath} fill="url(#area-grad)" className="transition-all duration-300" />
                    )}

                    {/* Line path */}
                    {areaChartPoints.linePath && (
                      <path
                        d={areaChartPoints.linePath}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Dot markers */}
                    {areaChartPoints.points.map((p, i) => (
                      <g key={i} className="group/dot cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5.5"
                          className="fill-background stroke-primary stroke-[3px] transition-all duration-200 group-hover/dot:r-7.5 group-hover/dot:stroke-[4px]"
                        />
                        {/* Custom SVG Tooltip inside SVG */}
                        <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-200 pointer-events-none">
                          <rect
                            x={p.x - 30}
                            y={p.y - 32}
                            width="60"
                            height="20"
                            rx="4"
                            className="fill-popover stroke-muted stroke shadow-sm"
                          />
                          <text
                            x={p.x}
                            y={p.y - 19}
                            className="text-[9px] font-extrabold fill-popover-foreground"
                            textAnchor="middle"
                          >
                            {p.count} logs
                          </text>
                        </g>
                        {/* X Axis label */}
                        <text
                          x={p.x}
                          y="182"
                          className="text-[10px] fill-muted-foreground text-center font-bold"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}

