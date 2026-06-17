"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { RoleEditor } from "../../role-editor";

export default function EditRolePage() {
  const { user } = useAuth();
  const params = useParams();
  const roleId = params.id as string;

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  if (!hasPermission(PERMISSIONS.ROLES_UPDATE)) {
    return <AccessDenied />;
  }

  return <RoleEditor roleId={roleId} mode="edit" />;
}
