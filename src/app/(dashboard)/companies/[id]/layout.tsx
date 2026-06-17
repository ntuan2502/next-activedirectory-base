"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { AccessDenied } from "@/components/access-denied";
import { LoadingSpinner } from "@/components/loading-overlay";
import { PERMISSIONS } from "@/config/permissions";
import { toast } from "sonner";

type CompanyRecord = {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  taxCode: string;
  taxAddress: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
  };
};

interface CompanyContextType {
  companyData: CompanyRecord | null;
  setCompanyData: React.Dispatch<React.SetStateAction<CompanyRecord | null>>;
  isLoading: boolean;
  fetchCompany: () => Promise<void>;
}

export const CompanyContext = createContext<CompanyContextType | null>(null);

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompanyContext must be used within a CompanyLayout");
  }
  return context;
}

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isLoading, setIsLoading] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyRecord | null>(null);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setCompanyData(data.data);
        } else {
          toast.error(data.error || t("errors.companyNotFound"));
          router.push("/companies");
        }
      } else {
        toast.error(t("errors.companyNotFound"));
        router.push("/companies");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, t, router]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.COMPANIES_READ)) {
      Promise.resolve().then(() => fetchCompany());
    }
  }, [fetchCompany, hasPermission]);

  if (!hasPermission(PERMISSIONS.COMPANIES_READ)) {
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
    <CompanyContext.Provider value={{ companyData, setCompanyData, isLoading, fetchCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}
