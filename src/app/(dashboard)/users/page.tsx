"use client";

import { useState, useEffect, useCallback } from "react";
import { Users as UsersIcon, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Swal from "sweetalert2";

type UserRecord = {
  id: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  department: string;
};

type UsersApiResponse = {
  success: boolean;
  data: UserRecord[];
};

type ApiErrorResponse = {
  error: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data: UsersApiResponse | ApiErrorResponse = await res.json();
        if ("data" in data) {
          setUsers(data.data);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (user: UserRecord) => {
    const result = await Swal.fire({
      title: "Delete user?",
      html: `Are you sure you want to delete <strong>${user.displayName || user.username}</strong>?<br/>This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        await Swal.fire({
          title: "Deleted!",
          text: `${user.displayName || user.username} has been removed.`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const data: ApiErrorResponse = await res.json();
        await Swal.fire("Error", data.error || "Failed to delete user.", "error");
      }
    } catch {
      await Swal.fire("Error", "Network error. Please try again.", "error");
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = search.toLowerCase();
    return (
      user.username.toLowerCase().includes(q) ||
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.department.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-2xl flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-primary" />
            Users
            {!isLoading && (
              <Badge variant="secondary">{filteredUsers.length} users</Badge>
            )}
          </CardTitle>
          <div className="flex gap-3 w-full sm:w-auto">
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-64"
            />
            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
                  <TableHead className="w-16 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username || "-"}</TableCell>
                      <TableCell>{user.displayName || "-"}</TableCell>
                      <TableCell>{user.firstName || "-"}</TableCell>
                      <TableCell>{user.lastName || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>{user.title || "-"}</TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {search ? "No users match your search." : "No users found. Sync data from the Dashboard first."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
