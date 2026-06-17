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
  isSystem: boolean;
};

type CompanyRecord = {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
};

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
  companyId: string;
  dn: string;
  roles: RoleRecord[];
};

interface UserContextType {
  userData: UserRecord | null;
  setUserData: React.Dispatch<React.SetStateAction<UserRecord | null>>;
  availableRoles: RoleRecord[];
  availableCompanies: CompanyRecord[];
  isLoading: boolean;
  fetchUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | null>(null);

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within a UserLayout");
  }
  return context;
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserRecord | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleRecord[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<CompanyRecord[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const [userRes, rolesRes, companiesRes] = await Promise.all([
        fetch(`/api/users/${userId}`),
        fetch("/api/roles"),
        fetch("/api/companies?limit=100"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        if (rolesData.success) {
          setAvailableRoles(rolesData.data);
        }
      }

      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        if (companiesData.success) {
          setAvailableCompanies(companiesData.data);
        }
      }

      if (userRes.ok) {
        const data = await userRes.json();
        if (data.success && data.data) {
          setUserData(data.data);
        } else {
          toast.error(data.error || t("errors.userNotFound"));
          router.push("/users");
        }
      } else {
        toast.error(t("errors.userNotFound"));
        router.push("/users");
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t, router]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.USERS_READ)) {
      Promise.resolve().then(() => fetchUser());
    }
  }, [fetchUser, hasPermission]);

  if (!hasPermission(PERMISSIONS.USERS_READ)) {
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
    <UserContext.Provider value={{ userData, setUserData, availableRoles, availableCompanies, isLoading, fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}
