"use client";

import { useState } from "react";
import { Server, Users, RefreshCw, CheckCircle, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth-provider";

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
  title: string;
};

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && "error" in data;
}

export default function DashboardPage() {
  const { user } = useAuth();
  
  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync state
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewUsers, setPreviewUsers] = useState<LdapUserPreview[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; error?: string; syncedCount?: number } | null>(null);
  const [search, setSearch] = useState("");

  const handleTestConnection = async () => {
    setIsTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ldap/test", { method: "POST" });
      const data: TestSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "message" in data) {
        setTestResult({ success: true, message: data.message });
      } else if (isApiError(data)) {
        setTestResult({ success: false, message: data.error });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network error";
      setTestResult({ success: false, message });
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
        // Default select all VALID users only (with email)
        const validUsers = data.data.filter((u: LdapUserPreview) => u.email && u.email.trim() !== "");
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

  const filteredPreviewUsers = previewUsers.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      (u.title || "").toLowerCase().includes(q)
    );
  });

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsernames(new Set(filteredPreviewUsers.filter(u => u.email && u.email.trim() !== "").map(u => u.username)));
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
    setSyncResult(null);
    try {
      const res = await fetch("/api/ldap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernamesToSync: Array.from(selectedUsernames) }),
      });
      const data: SyncSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "syncedCount" in data) {
        setSyncResult({ success: true, syncedCount: data.syncedCount });
        setIsSyncDialogOpen(false);
      } else if (isApiError(data)) {
        setSyncResult({ success: false, error: data.error });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network error";
      setSyncResult({ success: false, error: message });
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

  const sortedPreviewUsers = [...filteredPreviewUsers].sort((a, b) => {
    if (!sortConfig) return 0;
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

  const syncableUsersCount = filteredPreviewUsers.filter(u => u.email && u.email.trim() !== "").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Server className="w-6 h-6 text-primary" />
              Dashboard
            </CardTitle>
            <CardDescription className="mt-1">
              Signed in as <span className="font-medium text-foreground">{user?.username}</span>
            </CardDescription>
          </div>
          <div className="flex gap-3">
            {hasPermission("ldap:sync") && (
              <>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTestLoading}
                >
                  {isTestLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                  Test Connection
                </Button>
                
                <Dialog open={isSyncDialogOpen} onOpenChange={handleOpenSyncDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Users className="w-4 h-4 mr-2" />
                      Sync Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] md:max-w-4xl lg:max-w-6xl w-full max-h-[85vh] flex flex-col p-4 md:p-6 overflow-hidden">
                    <DialogHeader className="shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <DialogTitle className="flex items-center gap-2">
                          LDAP Sync Preview
                          {!isPreviewLoading && (
                            <Badge variant="secondary">{filteredPreviewUsers.length} users</Badge>
                          )}
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                          Review the users found in LDAP. Only users with email addresses can be selected for synchronization.
                        </DialogDescription>
                      </div>
                      <div className="flex gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                        <Input
                          placeholder="Search users..."
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
                          {search ? "No users match your search." : "No users found in LDAP."}
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
                                      Username
                                      {sortConfig?.key === "username" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                    </div>
                                  </TableHead>
                                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("displayName")}>
                                    <div className="flex items-center">
                                      Display Name
                                      {sortConfig?.key === "displayName" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                    </div>
                                  </TableHead>
                                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("email")}>
                                    <div className="flex items-center">
                                      Email
                                      {sortConfig?.key === "email" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                    </div>
                                  </TableHead>
                                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("title")}>
                                    <div className="flex items-center">
                                      Title / Role
                                      {sortConfig?.key === "title" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                    </div>
                                  </TableHead>
                                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort("department")}>
                                    <div className="flex items-center">
                                      Department
                                      {sortConfig?.key === "department" ? (sortConfig.direction === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />}
                                    </div>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortedPreviewUsers.map((u) => {
                                  const hasEmail = u.email && u.email.trim() !== "";
                                  return (
                                    <TableRow key={u.username} className={!hasEmail ? "opacity-60 bg-muted/20" : ""}>
                                      <TableCell className="w-12 text-center">
                                        <Checkbox 
                                          checked={selectedUsernames.has(u.username)}
                                          onCheckedChange={(checked) => toggleSelectUser(u.username, !!checked)}
                                          aria-label={`Select ${u.username}`}
                                          disabled={!hasEmail}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">{u.username}</TableCell>
                                      <TableCell>{u.displayName}</TableCell>
                                      <TableCell>
                                        {hasEmail ? u.email : <span className="text-destructive text-xs font-semibold">MISSING EMAIL</span>}
                                      </TableCell>
                                      <TableCell>{u.title || "-"}</TableCell>
                                      <TableCell>{u.department || "-"}</TableCell>
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
                        <span className="text-sm text-muted-foreground">
                          {selectedUsernames.size} of {syncableUsersCount} valid users selected
                        </span>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setIsSyncDialogOpen(false)}>Cancel</Button>
                          <Button 
                            onClick={handleConfirmSync} 
                            disabled={isSyncing || selectedUsernames.size === 0}
                          >
                            {isSyncing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Sync
                          </Button>
                        </div>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </CardHeader>

        {testResult && (
          <CardContent className="pt-0">
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {syncResult?.success && (
          <CardContent className="pt-0">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Successfully synced {syncResult.syncedCount} users to database.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        {syncResult?.error && (
          <CardContent className="pt-0">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{syncResult.error}</AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
