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

export interface DropdownCompany {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
}

export interface DropdownUser {
  id: string;
  username: string;
  displayName: string;
  companyIds?: string[];
  departmentIds?: string[];
}

export interface DropdownDepartment {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  companyId: string | null;
  parentId: string | null;
}

interface DepartmentContextType {
  departmentData: DepartmentRecord | null;
  setDepartmentData: React.Dispatch<React.SetStateAction<DepartmentRecord | null>>;
  availableCompanies: DropdownCompany[];
  availableUsers: DropdownUser[];
  availableDepartments: DropdownDepartment[];
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
  const [availableCompanies, setAvailableCompanies] = useState<DropdownCompany[]>([]);
  const [availableUsers, setAvailableUsers] = useState<DropdownUser[]>([]);
  const [availableDepartments, setAvailableDepartments] = useState<DropdownDepartment[]>([]);

  const fetchDepartment = useCallback(async () => {
    try {
      const [deptRes, companiesRes, usersRes, allDeptsRes] = await Promise.all([
        fetch(`/api/departments/${departmentId}`),
        fetch("/api/companies?limit=100"),
        fetch("/api/users?limit=1000"),
        fetch("/api/departments?limit=1000")
      ]);

      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        if (companiesData.success) {
          setAvailableCompanies(companiesData.data || []);
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (usersData.success) {
          setAvailableUsers(usersData.data || []);
        }
      }

      if (allDeptsRes.ok) {
        const allDeptsData = await allDeptsRes.json();
        if (allDeptsData.success) {
          setAvailableDepartments(allDeptsData.data || []);
        }
      }

      if (deptRes.ok) {
        const data = await deptRes.json();
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
    <DepartmentContext.Provider
      value={{
        departmentData,
        setDepartmentData,
        availableCompanies,
        availableUsers,
        availableDepartments,
        isLoading,
        fetchDepartment
      }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}
