"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { UserEditor } from "../user-editor";

export default function ViewUserPage() {
  const { user } = useAuth();
  const params = useParams();
  const userId = params.id as string;

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  if (!hasPermission(PERMISSIONS.USERS_READ)) {
    return <AccessDenied />;
  }

  return <UserEditor userId={userId} mode="view" />;
}
