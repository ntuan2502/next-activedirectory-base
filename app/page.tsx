"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Server, Users, RefreshCw, CheckCircle, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type LdapUser = {
  id: string;
  dn: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  title: string;
  department: string;
  phone: string;
};

type SessionUser = {
  userId: string;
  username: string;
};

type ApiErrorResponse = {
  error: string;
};

type TestSuccessResponse = {
  success: boolean;
  message: string;
};

type SyncSuccessResponse = {
  success: boolean;
  data: LdapUser[];
  syncedCount: number;
};

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && "error" in data;
}

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; error?: string; syncedCount?: number } | null>(null);
  const [users, setUsers] = useState<LdapUser[]>([]);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data: { user: SessionUser } = await res.json();
      setCurrentUser(data.user);
    } catch {
      router.push("/login");
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

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

  const handleSyncData = async () => {
    setIsSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ldap/sync", { method: "POST" });
      const data: SyncSuccessResponse | ApiErrorResponse = await res.json();
      if (res.ok && "data" in data) {
        setSyncResult({ success: true, syncedCount: data.syncedCount });
        setUsers(data.data ?? []);
      } else if (isApiError(data)) {
        setSyncResult({ success: false, error: data.error });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Network error";
      setSyncResult({ success: false, error: message });
    } finally {
      setIsSyncLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl w-full space-y-6">

        {/* Header Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Server className="w-6 h-6 text-primary" />
                Active Directory Sync
              </CardTitle>
              <CardDescription className="mt-1">
                Signed in as <span className="font-medium text-foreground">{currentUser?.username}</span>
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestLoading}
              >
                {isTestLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button
                onClick={handleSyncData}
                disabled={isSyncLoading}
              >
                {isSyncLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                Sync Data
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardHeader>

          {/* Status Alerts */}
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

        {/* Data Table Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Synchronized Users
              {users.length > 0 && (
                <Badge variant="secondary">{users.length} found</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Title / Role</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username || "-"}</TableCell>
                        <TableCell>{user.displayName || "-"}</TableCell>
                        <TableCell>{user.firstName || "-"}</TableCell>
                        <TableCell>{user.lastName || "-"}</TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>{user.phone || "-"}</TableCell>
                        <TableCell>{user.title || "-"}</TableCell>
                        <TableCell>{user.department || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        {isSyncLoading ? "Syncing data from LDAP..." : "No users synchronized yet. Click \"Sync Data\" to begin."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
