"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { PERMISSIONS } from "@/config/permissions";
import { DepartmentEditor } from "../../department-editor";

export default function EditDepartmentPage() {
  const { user } = useAuth();
  const params = useParams();
  const departmentId = params.id as string;

  const hasPermission = (perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  };

  if (!hasPermission(PERMISSIONS.DEPARTMENTS_UPDATE)) {
    return <AccessDenied />;
  }

  return <DepartmentEditor departmentId={departmentId} mode="edit" />;
}
