"use client";
 
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users as UsersIcon, Save, ArrowLeft, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
 
export default function NewUserPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
 
  const hasPermission = useCallback((perm: string) => {
    if (!user?.permissions) return false;
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(perm);
  }, [user]);
 
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesRes, companiesRes] = await Promise.all([
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
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);
 
  useEffect(() => {
    if (hasPermission(PERMISSIONS.USERS_CREATE)) {
      Promise.resolve().then(() => fetchData());
    }
  }, [fetchData, hasPermission]);
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !displayName || !email || !password) {
      toast.error(t("setupPage.errorRequiredFields"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("setupPage.errorPasswordMismatch"));
      return;
    }
 
    setIsSaving(true);
    try {
      const payload = {
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
        password
      };
 
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
 
      const data = await res.json();
      if (res.ok) {
        toast.success(t("usersPage.successCreateUser"));
        router.push("/users");
      } else {
        toast.error(data.error || t("usersPage.failedToCreateUser"));
      }
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setIsSaving(false);
    }
  };
 
  if (!hasPermission(PERMISSIONS.USERS_CREATE)) {
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
          className="h-10 w-10 cursor-pointer border-muted/70"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-primary" />
            {t("usersPage.addUser")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("usersPage.addUserDesc")}
          </p>
        </div>
      </div>
 
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal info & Password */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.userInfo")}
                </CardTitle>
                <CardDescription>
                  {t("usersPage.userInfoDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="font-semibold">
                      {t("usersPage.tableHeaders.username")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t("usersPage.placeholderUsername")}
                      required
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="font-semibold">
                      {t("usersPage.tableHeaders.displayName")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      placeholder={t("usersPage.placeholderDisplayName")}
                      required
                    />
                  </div>
 
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold">
                      {t("usersPage.tableHeaders.email")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("usersPage.placeholderEmail")}
                      required
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
                      placeholder={t("usersPage.placeholderPhone")}
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
                      placeholder={t("usersPage.placeholderFirstName")}
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
                      placeholder={t("usersPage.placeholderLastName")}
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
                      placeholder={t("usersPage.placeholderTitle")}
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
                      placeholder={t("usersPage.placeholderDepartment")}
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
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
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
          </div>
 
          {/* Right Column: Roles */}
          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("usersPage.rolesSection")}
                </CardTitle>
                <CardDescription>
                  {t("usersPage.rolesSectionDesc")}
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
                        className="border-muted/70"
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
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
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
