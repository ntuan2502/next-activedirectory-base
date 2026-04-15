"use client";

import { useState } from "react";
import { Server, Users, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

function isApiError(data: unknown): data is ApiErrorResponse {
  return typeof data === "object" && data !== null && "error" in data;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; error?: string; syncedCount?: number } | null>(null);

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
      if (res.ok && "syncedCount" in data) {
        setSyncResult({ success: true, syncedCount: data.syncedCount });
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
