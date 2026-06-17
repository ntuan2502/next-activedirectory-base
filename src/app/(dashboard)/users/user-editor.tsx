"use client";

import { useState, useEffect, useCallback, useContext } from "react";
import { useRouter } from "next/navigation";
import { Users as UsersIcon, Save, ArrowLeft, RefreshCw, AlertCircle, Edit, Eye, EyeOff } from "lucide-react";
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
import { UserContext } from "./[id]/layout";

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

interface UserEditorProps {
  userId?: string;
  mode: "view" | "edit" | "create";
}

export function UserEditor({ userId, mode }: UserEditorProps) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const userContext = useContext(UserContext);
  const contextUserData = userContext?.userData ?? null;
  const contextRoles = userContext?.availableRoles ?? [];
  const contextCompanies = userContext?.availableCompanies ?? [];

  const isCreateMode = mode === "create";
  const isLdapUser = !isCreateMode && contextUserData ? contextUserData.dn !== "" : false;
  const isReadOnly = mode === "view";

  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);

  const [isSaving, setIsSaving] = useState(false);

  // For create mode: local data loading
  const [isCreateLoading, setIsCreateLoading] = useState(isCreateMode);
  const [createRoles, setCreateRoles] = useState<RoleRecord[]>([]);
  const [createCompanies, setCreateCompanies] = useState<CompanyRecord[]>([]);

  const availableRoles = isCreateMode ? createRoles : contextRoles;
  const availableCompanies = isCreateMode ? createCompanies : contextCompanies;

  // Form fields - initialized from context data for view/edit
  const [username, setUsername] = useState(contextUserData?.username || "");
  const [displayName, setFormDisplayName] = useState(contextUserData?.displayName || "");
  const [firstName, setFirstName] = useState(contextUserData?.firstName || "");
  const [lastName, setLastName] = useState(contextUserData?.lastName || "");
  const [email, setEmail] = useState(contextUserData?.email || "");
  const [phone, setPhone] = useState(contextUserData?.phone || "");
  const [title, setTitle] = useState(contextUserData?.title || "");
  const [department, setDepartment] = useState(contextUserData?.department || "");
  const [companyId, setCompanyId] = useState(contextUserData?.companyId || "");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(contextUserData?.roles?.map((r) => r.id) || [])
  );

  // Password fields (create mode only)
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Change tracking for edit mode
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
  } | null>(contextUserData ? {
    displayName: contextUserData.displayName || "",
    firstName: contextUserData.firstName || "",
    lastName: contextUserData.lastName || "",
    email: contextUserData.email || "",
    phone: contextUserData.phone || "",
    title: contextUserData.title || "",
    department: contextUserData.department || "",
    companyId: contextUserData.companyId || "",
    roleIds: contextUserData.roles?.map((r) => r.id) || [],
  } : null);

  // Sync form state from context when data loads
  useEffect(() => {
    if (contextUserData) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setUsername(contextUserData.username || "");
      setFormDisplayName(contextUserData.displayName || "");
      setFirstName(contextUserData.firstName || "");
      setLastName(contextUserData.lastName || "");
      setEmail(contextUserData.email || "");
      setPhone(contextUserData.phone || "");
      setTitle(contextUserData.title || "");
      setDepartment(contextUserData.department || "");
      setCompanyId(contextUserData.companyId || "");
      const roleIds = contextUserData.roles?.map((r) => r.id) || [];
      setSelectedRoleIds(new Set(roleIds));
      setInitialUser({
        displayName: contextUserData.displayName || "",
        firstName: contextUserData.firstName || "",
        lastName: contextUserData.lastName || "",
        email: contextUserData.email || "",
        phone: contextUserData.phone || "",
        title: contextUserData.title || "",
        department: contextUserData.department || "",
        companyId: contextUserData.companyId || "",
        roleIds,
      });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [contextUserData]);

  // Fetch roles & companies for create mode
  const fetchCreateData = useCallback(async () => {
    setIsCreateLoading(true);
    try {
      const [rolesRes, companiesRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/companies?limit=100"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        if (rolesData.success) setCreateRoles(rolesData.data);
      }

      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        if (companiesData.success) setCreateCompanies(companiesData.data);
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsCreateLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isCreateMode && hasPermission(PERMISSIONS.USERS_CREATE)) {
      Promise.resolve().then(() => fetchCreateData());
    }
  }, [isCreateMode, fetchCreateData, hasPermission]);

  const areRoleIdsEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((x) => setA.has(x));
  };

  const isChanged = isCreateMode ? true : (
    !initialUser ? false : (
      displayName !== initialUser.displayName ||
      firstName !== initialUser.firstName ||
      lastName !== initialUser.lastName ||
      email !== initialUser.email ||
      phone !== initialUser.phone ||
      title !== initialUser.title ||
      department !== initialUser.department ||
      companyId !== initialUser.companyId ||
      !areRoleIdsEqual(Array.from(selectedRoleIds), initialUser.roleIds)
    )
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreateMode) {
      if (!username || !displayName || !email || !password) {
        toast.error(t("setupPage.errorRequiredFields"));
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t("setupPage.errorPasswordMismatch"));
        return;
      }
    } else {
      if (!isLdapUser && (!displayName || !email)) {
        toast.error(t("setupPage.errorRequiredFields"));
        return;
      }
    }

    setIsSaving(true);
    try {
      const url = isCreateMode ? "/api/users" : `/api/users/${userId}`;
      const method = isCreateMode ? "POST" : "PUT";
      const payload = isCreateMode
        ? {
            username,
            displayName,
            firstName,
            lastName,
            email,
            phone,
            title,
            department,
            companyId: companyId || null,
            roleIds: Array.from(selectedRoleIds),
            password,
          }
        : {
            displayName,
            firstName,
            lastName,
            email,
            phone,
            title,
            department,
            companyId: companyId || null,
            roleIds: Array.from(selectedRoleIds),
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(isCreateMode ? t("usersPage.successCreateUser") : t("usersPage.successUpdateUser"));
        if (!isCreateMode) {
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
        }
        router.push("/users");
      } else {
        toast.error(data.error || (isCreateMode ? t("usersPage.failedToCreateUser") : t("usersPage.failedToUpdateUser")));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  // Permission check
  if (isCreateMode && !hasPermission(PERMISSIONS.USERS_CREATE)) {
    return <AccessDenied />;
  }
  if (!isCreateMode && !hasPermission(PERMISSIONS.USERS_READ)) {
    return <AccessDenied />;
  }

  // Show loading for create mode data
  if (isCreateMode && isCreateLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  // Header title/description based on mode
  const headerTitle = isCreateMode
    ? t("usersPage.addUser")
    : isReadOnly
      ? t("usersPage.viewUser")
      : t("usersPage.editUser");

  const headerDescription = isCreateMode
    ? t("usersPage.addUserDesc")
    : isReadOnly
      ? t("usersPage.viewUserDesc")
      : t("usersPage.editUserDesc");

  const isFieldDisabled = isReadOnly || isLdapUser;

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/users")}
            disabled={isSaving}
            className="h-10 w-10 cursor-pointer border-muted/70"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <UsersIcon className="w-8 h-8 text-primary" />
              {headerTitle}
            </h1>
            <p className="text-muted-foreground mt-1">
              {headerDescription}
              {!isCreateMode && contextUserData?.username && (
                <>: <strong className="text-foreground">{contextUserData.username}</strong></>
              )}
            </p>
          </div>
        </div>

        {mode === "view" && hasPermission(PERMISSIONS.USERS_UPDATE) && (
          <Button
            onClick={() => router.push(`/users/${userId}/edit`)}
            className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0 flex items-center gap-2 self-start sm:self-center"
          >
            <Edit className="h-4 w-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      {!isCreateMode && isLdapUser && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-bold">{t("usersPage.status.synced")}</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {isReadOnly ? t("usersPage.ldapUserViewWarning") : t("usersPage.ldapUserWarning")}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: User Profile info & Password */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.userInfo")}
                </CardTitle>
                <CardDescription>
                  {isCreateMode
                    ? t("usersPage.userInfoDesc")
                    : isLdapUser
                      ? t("usersPage.ldapInfoManaged")
                      : t("usersPage.localInfoFill")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="font-semibold">
                      {t("usersPage.tableHeaders.username")} {isCreateMode && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={isCreateMode ? (e) => setUsername(e.target.value) : undefined}
                      disabled={!isCreateMode}
                      placeholder={isCreateMode ? t("usersPage.placeholderUsername") : undefined}
                      className="disabled:bg-muted/30"
                      required={isCreateMode}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="font-semibold">
                      {t("usersPage.tableHeaders.displayName")} {!isReadOnly && !isLdapUser && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      disabled={isFieldDisabled}
                      placeholder={t("usersPage.placeholderDisplayName")}
                      className="disabled:bg-muted/30"
                      required={!isLdapUser}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold">
                      {t("usersPage.tableHeaders.email")} {!isReadOnly && !isLdapUser && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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
                      disabled={isFieldDisabled}
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

            {/* Password section - only for create mode */}
            {isCreateMode && (
              <Card className="shadow-lg">
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    {t("usersPage.passwordSection")}
                  </CardTitle>
                  <CardDescription>
                    {t("usersPage.passwordSectionDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-semibold">
                        {t("usersPage.password")} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t("usersPage.placeholderEnterPassword")}
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground focus:outline-none cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="font-semibold">
                        {t("usersPage.confirmPassword")} <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t("usersPage.placeholderConfirmPassword")}
                          className="pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground focus:outline-none cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Roles */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.rolesSection")}
                </CardTitle>
                <CardDescription>
                  {isCreateMode
                    ? t("usersPage.rolesSectionDesc")
                    : t("usersPage.rolesSectionEditDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 bg-muted/10 p-4 rounded-xl border">
                  {availableRoles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2 py-1.5 px-2 hover:bg-muted/30 transition-colors rounded-lg">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.has(role.id)}
                        disabled={isReadOnly}
                        onCheckedChange={(checked) => {
                          if (isReadOnly) return;
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
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-muted text-muted-foreground font-normal">
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
            {isReadOnly ? t("common.close") : t("common.cancel")}
          </Button>
          {!isReadOnly && (
            <Button
              type="submit"
              disabled={
                isSaving ||
                (isCreateMode
                  ? !username.trim() || !displayName.trim() || !email.trim() || !password || !confirmPassword
                  : (!isLdapUser && (!displayName.trim() || !email.trim())) || !isChanged)
              }
              className="h-10 px-5 font-semibold text-sm bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer border-0"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("common.save")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
