"use client";

import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { UserEditor } from "../user-editor";

export default function NewUserPage() {
  const { user } = useAuth();

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  if (!hasPermission(PERMISSIONS.USERS_CREATE)) {
    return <AccessDenied />;
  }

  return <UserEditor mode="create" />;
}
