"use client";
 
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Users as UsersIcon, Save, ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
 
export default function EditUserPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
 
  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);
 
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLdapUser, setIsLdapUser] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RoleRecord[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<CompanyRecord[]>([]);
 
  // Form fields
  const [username, setUsername] = useState("");
  const [displayName, setFormDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [initialUser, setInitialUser] = useState<{
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title: string;
    department: string;
    companyId: string;
    roleIds: string[];
  } | null>(null);

  const areRoleIdsEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every(x => setA.has(x));
  };

  const isChanged = !initialUser ? false : (
    displayName !== initialUser.displayName ||
    firstName !== initialUser.firstName ||
    lastName !== initialUser.lastName ||
    email !== initialUser.email ||
    phone !== initialUser.phone ||
    title !== initialUser.title ||
    department !== initialUser.department ||
    companyId !== initialUser.companyId ||
    !areRoleIdsEqual(Array.from(selectedRoleIds), initialUser.roleIds)
  );
 
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [userRes, rolesRes, companiesRes] = await Promise.all([
        fetch(`/api/users/${userId}`),
        fetch("/api/roles"),
        fetch("/api/companies?limit=100")
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
        const userData = await userRes.json();
        if (userData.success && userData.data) {
          const u = userData.data;
          setUsername(u.username || "");
          setFormDisplayName(u.displayName || "");
          setFirstName(u.firstName || "");
          setLastName(u.lastName || "");
          setEmail(u.email || "");
          setPhone(u.phone || "");
          setTitle(u.title || "");
          setDepartment(u.department || "");
          setCompanyId(u.companyId || "");
          setIsLdapUser(u.dn !== "");
          const roleIds = u.roles?.map((r: { id: string }) => r.id) || [];
          setSelectedRoleIds(new Set(roleIds));
          setInitialUser({
            displayName: u.displayName || "",
            firstName: u.firstName || "",
            lastName: u.lastName || "",
            email: u.email || "",
            phone: u.phone || "",
            title: u.title || "",
            department: u.department || "",
            companyId: u.companyId || "",
            roleIds,
          });
        } else {
          toast.error(userData.error || t("errors.userNotFound"));
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
    if (hasPermission(PERMISSIONS.USERS_UPDATE)) {
      Promise.resolve().then(() => fetchData());
    }
  }, [fetchData, hasPermission]);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLdapUser && (!displayName || !email)) {
      toast.error(t("setupPage.errorRequiredFields"));
      return;
    }
 
    setIsSaving(true);
    try {
      const payload = {
        displayName,
        firstName,
        lastName,
        email,
        phone,
        title,
        department,
        companyId: companyId || null,
        roleIds: Array.from(selectedRoleIds)
      };
 
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
 
      const data = await res.json();
      if (res.ok) {
        toast.success(t("usersPage.successUpdateUser"));
        setInitialUser({
          displayName,
          firstName,
          lastName,
          email,
          phone,
          title,
          department,
          companyId,
          roleIds: Array.from(selectedRoleIds),
        });
        router.push("/users");
      } else {
        toast.error(data.error || t("usersPage.failedToUpdateUser"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };
 
  if (!hasPermission(PERMISSIONS.USERS_UPDATE)) {
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
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/users")}
          disabled={isSaving}
          className="h-10 w-10 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-primary" />
            {t("usersPage.editUser")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("usersPage.editUserDesc")}: <strong className="text-foreground">{username}</strong>
          </p>
        </div>
      </div>
 
      {isLdapUser && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-bold">{t("usersPage.status.synced")}</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {t("usersPage.ldapUserWarning")}
          </AlertDescription>
        </Alert>
      )}
 
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: User Profile info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.userInfo")}
                </CardTitle>
                <CardDescription>
                  {isLdapUser ? t("usersPage.ldapInfoManaged") : t("usersPage.localInfoFill")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="font-semibold">
                      {t("usersPage.tableHeaders.username")}
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      disabled
                      className="bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="font-semibold">
                      {t("usersPage.tableHeaders.displayName")} {!isLdapUser && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderDisplayName")}
                      className="disabled:bg-muted/30"
                      required={!isLdapUser}
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold">
                      {t("usersPage.tableHeaders.email")} {!isLdapUser && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderEmail")}
                      className="disabled:bg-muted/30"
                      required={!isLdapUser}
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-semibold">
                      {t("usersPage.phone")}
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderPhone")}
                      className="disabled:bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-semibold">
                      {t("usersPage.firstName")}
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderFirstName")}
                      className="disabled:bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-semibold">
                      {t("usersPage.lastName")}
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderLastName")}
                      className="disabled:bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="title" className="font-semibold">
                      {t("usersPage.tableHeaders.title")}
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderTitle")}
                      className="disabled:bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="department" className="font-semibold">
                      {t("usersPage.tableHeaders.department")}
                    </Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={isLdapUser}
                      placeholder={t("usersPage.placeholderDepartment")}
                      className="disabled:bg-muted/30"
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="company" className="font-semibold">
                      {t("usersPage.tableHeaders.company")}
                    </Label>
                    <select
                      id="company"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      disabled={isLdapUser}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/30 cursor-pointer"
                    >
                      <option value="">-- {t("common.none")} --</option>
                      {availableCompanies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {locale === "vi" ? c.nameVi : c.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
 
          {/* Right Column: Roles */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.rolesSection")}
                </CardTitle>
                <CardDescription>
                  {t("usersPage.rolesSectionEditDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 bg-muted/10 p-4 rounded-xl border">
                  {availableRoles.map(role => (
                    <div key={role.id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.has(role.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRoleIds((prev) => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(role.id);
                            } else {
                              next.delete(role.id);
                            }
                            return next;
                          });
                        }}
                      />
                      <Label htmlFor={`role-${role.id}`} className="text-sm font-semibold cursor-pointer flex items-center gap-1.5 select-none">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground font-normal">
                            {t("common.system")}
                          </Badge>
                        )}
                      </Label>
                    </div>
                  ))}
                  {availableRoles.length === 0 && (
                    <p className="text-muted-foreground text-xs italic">{t("rolesPage.noRolesAvailable")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
 
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/users")}
            disabled={isSaving}
            className="h-10 px-5 font-semibold text-sm cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSaving || (!isLdapUser && (!displayName.trim() || !email.trim())) || !isChanged}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
