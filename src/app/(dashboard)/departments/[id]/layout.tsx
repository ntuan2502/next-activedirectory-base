"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { LoadingSpinner } from "@/components/loading-overlay";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

interface DepartmentRecord {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyId: string | null;
  parentId: string | null;
  managerId: string | null;
  companyObj: {
    id: string;
    code: string;
    nameVi: string;
    nameEn: string;
  } | null;
  parentObj: {
    id: string;
    code: string;
    nameVi: string;
    nameEn: string;
  } | null;
  managerObj: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  _count: {
    users: number;
  };
  users?: {
    id: string;
    username: string;
    displayName: string;
  }[];
}

interface DepartmentContextType {
  departmentData: DepartmentRecord | null;
  setDepartmentData: React.Dispatch<React.SetStateAction<DepartmentRecord | null>>;
  isLoading: boolean;
  fetchDepartment: () => Promise<void>;
}

export const DepartmentContext = createContext<DepartmentContextType | null>(null);

export function useDepartmentContext() {
  const context = useContext(DepartmentContext);
  if (!context) {
    throw new Error("useDepartmentContext must be used within a DepartmentLayout");
  }
  return context;
}

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isLoading, setIsLoading] = useState(true);
  const [departmentData, setDepartmentData] = useState<DepartmentRecord | null>(null);

  const fetchDepartment = useCallback(async () => {
    try {
      const res = await fetch(`/api/departments/${departmentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setDepartmentData(data.data);
        } else {
          toast.error(data.error || t("errors.departmentNotFound"));
          router.push("/departments");
        }
      } else {
        toast.error(t("errors.departmentNotFound"));
        router.push("/departments");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [departmentId, t, router]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.DEPARTMENTS_READ)) {
      Promise.resolve().then(() => fetchDepartment());
    }
  }, [fetchDepartment, hasPermission]);

  if (!hasPermission(PERMISSIONS.DEPARTMENTS_READ)) {
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
    <DepartmentContext.Provider value={{ departmentData, setDepartmentData, isLoading, fetchDepartment }}>
      {children}
    </DepartmentContext.Provider>
  );
}
