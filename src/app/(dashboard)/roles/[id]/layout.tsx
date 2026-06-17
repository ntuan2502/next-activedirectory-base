"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { LoadingSpinner } from "@/components/loading-overlay";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  permissions: string;
  isSystem: boolean;
};

interface RoleContextType {
  roleData: RoleRecord | null;
  setRoleData: React.Dispatch<React.SetStateAction<RoleRecord | null>>;
  isLoading: boolean;
  fetchRole: () => Promise<void>;
}

export const RoleContext = createContext<RoleContextType | null>(null);

export function useRoleContext() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRoleContext must be used within a RoleLayout");
  }
  return context;
}

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const roleId = params.id as string;

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isLoading, setIsLoading] = useState(true);
  const [roleData, setRoleData] = useState<RoleRecord | null>(null);

  const fetchRole = useCallback(async () => {
    try {
      const res = await fetch(`/api/roles/${roleId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setRoleData(data.data);
        } else {
          toast.error(data.error || t("errors.roleNotFound"));
          router.push("/roles");
        }
      } else {
        toast.error(t("errors.roleNotFound"));
        router.push("/roles");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [roleId, t, router]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.ROLES_READ)) {
      Promise.resolve().then(() => fetchRole());
    }
  }, [fetchRole, hasPermission]);

  if (!hasPermission(PERMISSIONS.ROLES_READ)) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <RoleContext.Provider value={{ roleData, setRoleData, isLoading, fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}
