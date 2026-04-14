"use client";

import { useState } from "react";
import { Server, Users, RefreshCw, CheckCircle, XCircle } from "lucide-react";

type LdapUser = {
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

export default function Dashboard() {
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [users, setUsers] = useState<LdapUser[]>([]);

  const handleTestConnection = async () => {
    setIsTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ldap/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data.error });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Network error" });
    } finally {
      setIsTestLoading(false);
    }
  };

  const handleSyncData = async () => {
    setIsSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ldap/sync", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setSyncResult({ success: true });
        setUsers(json.data || []);
      } else {
        setSyncResult({ success: false, error: json.error });
      }
    } catch (error: any) {
      setSyncResult({ success: false, error: error.message || "Network error" });
    } finally {
      setIsSyncLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 dark:bg-zinc-900">
      <div className="max-w-7xl w-full space-y-8">

        {/* Header Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 dark:bg-zinc-800 dark:border-zinc-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Active Directory Sync
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage and synchronize user data from your LDAP/Active Directory server.
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleTestConnection}
                disabled={isTestLoading}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isTestLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                Test Connection
              </button>
              <button
                onClick={handleSyncData}
                disabled={isSyncLoading}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSyncLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                Sync Data
              </button>
            </div>
          </div>

          {/* Test Status Alert */}
          {testResult && (
            <div className={`mt-4 p-4 rounded-md flex items-center gap-3 ${testResult.success ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
              {testResult.success ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{testResult.message}</span>
            </div>
          )}

          {/* Sync Error Alert */}
          {syncResult?.error && (
            <div className="mt-4 p-4 rounded-md flex items-center gap-3 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{syncResult.error}</span>
            </div>
          )}
        </div>

        {/* Data Table Section */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-100 overflow-hidden dark:bg-zinc-800 dark:border-zinc-700">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-700">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              Synchronized Users {users.length > 0 && <span className="text-sm text-gray-500 ml-2">({users.length} found)</span>}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-900/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Display Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">First Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title / Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-zinc-800 dark:divide-zinc-700">
                {users.length > 0 ? (
                  users.map((user, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-zinc-200">{user.username || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.displayName || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.firstName || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.lastName || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.email || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.phone || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.title || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-zinc-400">{user.department || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-zinc-400">
                      {isSyncLoading ? "Syncing data from LDAP..." : "No users synchronized yet. Click 'Sync Data' to begin."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
